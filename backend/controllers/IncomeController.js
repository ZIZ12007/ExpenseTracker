const xlsx = require('xlsx')
const Income = require('../models/Income');

// Add Income Source
exports.addIncome = async (req, res) => {

    const userId = req.user.id;

    try {
        const { source, amount, date } = req.body;

        // Validation check for missing fields
        if (!source?.trim() || !Number.isFinite(Number(amount)) || Number(amount) <= 0) {
            return res.status(400).json({ message: 'Please provide source and amount' });
        }

        const newIncome = new Income({
            userId,
            source,
            amount,
            date: date ? new Date(date) : undefined
        })

        await newIncome.save();
        res.status(200).json({ newIncome })
    } catch (error) {
        console.error('IncomeController.addIncome error:', error);
        res.status(500).json({ message: 'Server error' })
    }
}

// Get Income Sources
exports.getAllIncome = async (req, res) => {
    // Ensure the user is authenticated
    if (!req.user || !req.user.id) {
        return res.status(401).json({ message: 'Not authorized' })
    }

    const userId = req.user.id

    try {
        const income = await Income.find({ userId }).sort({ date: -1 })
        res.status(200).json(income)
    } catch (error) {
        console.error('IncomeController.getAllIncome error:', error)
        res.status(500).json({ message: 'Server error' })
    }
}

// Delete Income Source
exports.deleteIncome = async (req, res) => {
    try {
        const deletedIncome = await Income.findOneAndDelete({
            _id: req.params.id,
            userId: req.user.id,
        })
        if (!deletedIncome) {
            return res.status(404).json({ message: 'Income not found' })
        }
        res.json({ message: 'Income deleted successfully' })
    } catch (error) {
        console.error('IncomeController.deleteIncome error:', error)
        res.status(500).json({ message: 'Server Error' })
    }
};

// Download Income as Excel
exports.downloadIncomeExcel = async (req, res) => {
    const userId = req.user.id

    try {
        const income = await Income.find({ userId }).sort({ date: -1})

        //Prepare data for excel
        const data = income.map((item) => ({
            Source: item.source,
            Amount: item.amount,
            Date: item.date,
        }))

        const wb = xlsx.utils.book_new()
        const ws = xlsx.utils.json_to_sheet(data)
        xlsx.utils.book_append_sheet(wb, ws, "Income")
        const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' })
        res.setHeader('Content-Disposition', 'attachment; filename="income_details.xlsx"')
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        res.send(buffer)
    } catch (error) {
        res.status(500).json({ message: "Server Error" })
    }
}