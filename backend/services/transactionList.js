const { Types } = require('mongoose');

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Parses pagination parameters from the query string.
 */
const parsePaging = (query = {}) => {
    const page = Math.max(Number.parseInt(query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(Number.parseInt(query.limit, 10) || DEFAULT_LIMIT, 1), MAX_LIMIT);
    return { page, limit, skip: (page - 1) * limit };
};

/**
 * The first instant of the current month, in UTC.
 */
const monthStart = () => {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
};

/**
 * Lists a user's transactions with pagination, search and totals.
 *
 * Everything is computed in a single round trip using $facet, so the response
 * costs one query no matter how many pages the user has.
 */
const listTransactions = async (Model, { userId, query = {}, searchFields = [] }) => {
    const { page, limit, skip } = parsePaging(query);

    // Aggregations are not cast by Mongoose, so the id has to be converted.
    const match = { userId: new Types.ObjectId(String(userId)) };
    const search = (query.search || '').trim();
    if (search && searchFields.length) {
        const pattern = new RegExp(escapeRegex(search), 'i');
        match.$or = searchFields.map((field) => ({ [field]: pattern }));
    }

    const [result] = await Model.aggregate([
        { $match: match },
        { $sort: { date: -1 } },
        {
            $facet: {
                items: [
                    { $skip: skip },
                    { $limit: limit },
                ],
                count: [{ $count: 'total' }],
                totals: [
                    {
                        $group: {
                            _id: null,
                            allTime: { $sum: '$amount' },
                            thisMonth: {
                                $sum: {
                                    $cond: [{ $gte: ['$date', monthStart()] }, '$amount', 0],
                                },
                            },
                        },
                    },
                ],
            },
        },
    ]);

    const items = result?.items || [];
    const total = result?.count?.[0]?.total || 0;
    const totals = result?.totals?.[0] || {};

    return {
        data: items,
        pagination: {
            page,
            limit,
            total,
            pages: Math.max(Math.ceil(total / limit), 1),
        },
        summary: {
            allTime: totals.allTime || 0,
            thisMonth: totals.thisMonth || 0,
        },
    };
};

module.exports = { listTransactions, parsePaging, DEFAULT_LIMIT, MAX_LIMIT };
