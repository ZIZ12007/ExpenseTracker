import { useCallback, useEffect, useMemo, useState } from 'react'
import DashboardLayout from '../../components/Layout/DashboardLayout'
import { useUserAuth } from '../../hooks/useUserAuth'
import axiosInstance from '../../utils/axiosInstance'
import { API_PATHS } from '../../utils/apiPaths'
import InfoCard from '../../components/Cards/InfoCard'
import { LuArrowDownLeft, LuArrowUpRight, LuWallet } from 'react-icons/lu'
import {
  Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts'

const COLORS = ['#7957e8', '#18a879', '#f59e0b', '#f06565', '#3b82f6', '#ec4899', '#14b8a6', '#8b5cf6']
const money = (value) => new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', maximumFractionDigits: 0,
}).format(Number(value) || 0)
const shortMoney = (value) => {
  const amount = Number(value) || 0
  return amount >= 1000 ? `$${(amount / 1000).toFixed(amount >= 10000 ? 0 : 1)}k` : `$${amount}`
}
const dateLabel = (date) => new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

const Home = () => {
  useUserAuth()

  const [dashboardData, setDashboardData] = useState(null)
  const [loading, setLoading] = useState(() => Boolean(localStorage.getItem('token')))
  const [error, setError] = useState('')

  const token = localStorage.getItem('token')

  const fetchDashboardData = useCallback(async () => {
    if (!token) {
      return
    }
    try {
      const response = await axiosInstance.get(API_PATHS.DASHBOARD.GET_DATA)
      setDashboardData(response.data || {})
      setError('')
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Dashboard data could not be loaded. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    if (!token) return undefined
    let active = true
    axiosInstance.get(API_PATHS.DASHBOARD.GET_DATA).then((response) => {
      if (active) setDashboardData(response.data || {})
    }).catch((requestError) => {
      if (active) setError(requestError.response?.data?.message || 'Dashboard data could not be loaded. Please try again.')
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [token])

  const expenseByDay = useMemo(() => {
    const totals = new Map()
    const now = new Date()
    for (let offset = 29; offset >= 0; offset -= 1) {
      const date = new Date(now)
      date.setDate(now.getDate() - offset)
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
      totals.set(key, 0)
    }
    ;(dashboardData?.last30DaysExpense?.transactions || []).forEach((item) => {
      const date = new Date(item.date)
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
      if (totals.has(key)) totals.set(key, totals.get(key) + Number(item.amount || 0))
    })
    return [...totals.entries()].map(([date, total]) => ({
      date,
      label: new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      total,
    }))
  }, [dashboardData])

  const summaryCards = [
    {
      icon: <LuWallet />,
      label: 'Total Balance',
      value: money(dashboardData?.totalBalance),
      color: 'bg-gradient-to-br from-violet-600 to-indigo-600',
    },
    {
      icon: <LuArrowUpRight />,
      label: 'Total Income',
      value: money(dashboardData?.totalIncome),
      color: 'bg-gradient-to-br from-emerald-500 to-teal-600',
    },
    {
      icon: <LuArrowDownLeft />,
      label: 'Total Expenses',
      value: money(dashboardData?.totalExpenses),
      color: 'bg-gradient-to-br from-rose-500 to-orange-500',
    },
  ]
  const overviewData = [
    { name: 'Income', value: Number(dashboardData?.totalIncome) || 0 },
    { name: 'Expenses', value: Number(dashboardData?.totalExpenses) || 0 },
  ].filter((item) => item.value > 0)
  const incomeData = (dashboardData?.incomeBySource || []).map((item) => ({ name: item.name || 'Other', value: Number(item.total) || 0 })).filter((item) => item.value > 0)
  const expenseData = dashboardData?.expensesByCategory || []
  const incomeTransactions = dashboardData?.last60DaysIncome?.transactions || []
  const expenseTransactions = dashboardData?.last30DaysExpense?.transactions || []
  const recentTransactions = dashboardData?.recentTransactions || []

  return (
    <DashboardLayout activeMenu='Dashboard'>
      <div className='mx-auto max-w-7xl space-y-6 py-2'>
        <header className='flex flex-col justify-between gap-2 sm:flex-row sm:items-end'>
          <div>
            <p className='text-sm font-semibold uppercase tracking-[0.2em] text-violet-600'>Your financial snapshot</p>
            <h1 className='mt-2 text-3xl font-bold text-slate-900'>Dashboard</h1>
            <p className='mt-1 text-sm text-slate-500'>A clear view of where your money is going.</p>
          </div>
          <p className='text-sm text-slate-500'>Updated just now</p>
        </header>

        {!token && <div className='rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800'>Sign in to load your personal dashboard data.</div>}
        {error && <div role='alert' className='flex items-center justify-between gap-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700'><span>{error}</span><button onClick={fetchDashboardData} className='shrink-0 font-semibold underline'>Retry</button></div>}

        <div className='grid grid-cols-1 gap-4 md:grid-cols-3'>
          {summaryCards.map((card) => (
            <InfoCard
              key={card.label}
              icon={card.icon}
              label={card.label}
              value={card.value}
              color={card.color}
            />
          ))}
        </div>

        {loading ? <div className='rounded-2xl border border-slate-100 bg-white p-10 text-center text-sm text-slate-500 shadow-sm'>Loading your financial data…</div> : <>
          <div className='grid gap-6 lg:grid-cols-2'>
            <section className='rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6'>
              <div className='mb-5'><h2 className='text-lg font-semibold text-slate-900'>Financial overview</h2><p className='mt-1 text-sm text-slate-500'>Income compared with expenses</p></div>
              {overviewData.length ? <div className='grid items-center gap-4 sm:grid-cols-[1.1fr_0.9fr]'>
                <div className='h-56 min-w-0'>
                  <ResponsiveContainer width='100%' height='100%'><PieChart><Pie data={overviewData} dataKey='value' nameKey='name' innerRadius={58} outerRadius={88} paddingAngle={4} stroke='none'>{overviewData.map((item, index) => <Cell key={item.name} fill={index === 0 ? '#18a879' : '#f06565'} />)}</Pie><Tooltip formatter={(value) => money(value)} /></PieChart></ResponsiveContainer>
                </div>
                <div className='space-y-4'>{overviewData.map((item, index) => <div key={item.name} className='flex items-center justify-between gap-3'><div className='flex items-center gap-2'><span className='h-2.5 w-2.5 rounded-full' style={{ backgroundColor: index === 0 ? '#18a879' : '#f06565' }} /><span className='text-sm text-slate-500'>{item.name}</span></div><span className='font-semibold text-slate-800'>{money(item.value)}</span></div>)}<div className='border-t border-slate-100 pt-4'><p className='text-xs text-slate-500'>Available balance</p><p className='mt-1 text-xl font-bold text-violet-700'>{money(dashboardData?.totalBalance)}</p></div></div>
              </div> : <EmptyChart message='Add income or expenses to see your financial overview.' />}
            </section>

            <section className='rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6'>
              <div className='mb-4 flex items-start justify-between'><div><h2 className='text-lg font-semibold text-slate-900'>Recent transactions</h2><p className='mt-1 text-sm text-slate-500'>Your latest activity</p></div><span className='rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600'>{recentTransactions.length} items</span></div>
              {recentTransactions.length ? <div className='divide-y divide-slate-100'>{recentTransactions.slice(0, 6).map((entry) => <div key={`${entry.type}-${entry._id}`} className='flex items-center gap-3 py-3 first:pt-1 last:pb-0'><span className={`flex h-10 w-10 items-center justify-center rounded-xl ${entry.type === 'income' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>{entry.type === 'income' ? <LuArrowUpRight /> : <LuArrowDownLeft />}</span><div className='min-w-0 flex-1'><p className='truncate text-sm font-medium text-slate-800'>{entry.type === 'income' ? (entry.source || 'Income') : (entry.category || 'Expense')}</p><p className='mt-0.5 text-xs text-slate-500'>{dateLabel(entry.date)}</p></div><span className={`whitespace-nowrap text-sm font-semibold ${entry.type === 'income' ? 'text-emerald-600' : 'text-slate-800'}`}>{entry.type === 'income' ? '+' : '−'}{money(entry.amount)}</span></div>)}</div> : <EmptyChart message='Your recent activity will appear here.' />}
            </section>
          </div>

          <section className='rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6'>
            <div className='mb-5 flex items-start justify-between'><div><h2 className='text-lg font-semibold text-slate-900'>Last 30 days expenses</h2><p className='mt-1 text-sm text-slate-500'>Daily spending activity</p></div><span className='text-sm font-semibold text-rose-600'>{money(dashboardData?.last30DaysExpense?.total)}</span></div>
            {expenseTransactions.length ? <div className='h-64 min-w-0'><ResponsiveContainer width='100%' height='100%'><BarChart data={expenseByDay} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}><CartesianGrid vertical={false} strokeDasharray='3 3' stroke='#eef0f5' /><XAxis dataKey='label' tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval={4} /><YAxis tickFormatter={shortMoney} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={48} /><Tooltip formatter={(value) => money(value)} labelStyle={{ color: '#334155' }} /><Bar dataKey='total' name='Expenses' fill='#f06565' radius={[5, 5, 0, 0]} maxBarSize={22} /></BarChart></ResponsiveContainer></div> : <EmptyChart message='No expenses recorded during the last 30 days.' />}
          </section>

          <div className='grid gap-6 lg:grid-cols-2'>
            <section className='rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6'>
              <div className='mb-4'><h2 className='text-lg font-semibold text-slate-900'>Last 60 days income</h2><p className='mt-1 text-sm text-slate-500'>Income split by source</p></div>
              {incomeTransactions.length && incomeData.length ? <div className='grid items-center gap-3 sm:grid-cols-[1fr_1fr]'><div className='h-56 min-w-0'><ResponsiveContainer width='100%' height='100%'><PieChart><Pie data={incomeData} dataKey='value' nameKey='name' innerRadius={48} outerRadius={82} paddingAngle={3} stroke='none'>{incomeData.map((item, index) => <Cell key={item.name} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip formatter={(value) => money(value)} /></PieChart></ResponsiveContainer></div><div className='max-h-48 space-y-3 overflow-y-auto'>{incomeData.map((item, index) => <div key={item.name} className='flex items-center justify-between gap-2 text-sm'><span className='flex min-w-0 items-center gap-2 text-slate-500'><span className='h-2.5 w-2.5 shrink-0 rounded-full' style={{ backgroundColor: COLORS[index % COLORS.length] }} /><span className='truncate'>{item.name}</span></span><span className='font-semibold text-slate-800'>{money(item.value)}</span></div>)}</div></div> : <EmptyChart message='No income recorded during the last 60 days.' />}
              <p className='mt-2 border-t border-slate-100 pt-3 text-sm text-slate-500'>Total received <span className='float-right font-semibold text-emerald-600'>{money(dashboardData?.last60DaysIncome?.total)}</span></p>
            </section>

            <section className='rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6'>
              <div className='mb-5'><h2 className='text-lg font-semibold text-slate-900'>Expense details</h2><p className='mt-1 text-sm text-slate-500'>Spending by category · all time</p></div>
              {expenseData.length ? <div className='space-y-4'>{expenseData.map((item, index) => { const max = Math.max(...expenseData.map((entry) => Number(entry.total) || 0), 1); return <div key={item.name}><div className='mb-1.5 flex items-center justify-between gap-3 text-sm'><span className='truncate font-medium text-slate-700'>{item.name || 'Other'}</span><span className='shrink-0 font-semibold text-slate-800'>{money(item.total)}</span></div><div className='h-2 overflow-hidden rounded-full bg-slate-100'><div className='h-full rounded-full' style={{ width: `${Math.max(3, (Number(item.total) / max) * 100)}%`, backgroundColor: COLORS[index % COLORS.length] }} /></div></div>})}</div> : <EmptyChart message='Your category breakdown appears after you add expenses.' />}
            </section>
          </div>

          <section className='rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6'>
            <div className='mb-5'><h2 className='text-lg font-semibold text-slate-900'>Income details</h2><p className='mt-1 text-sm text-slate-500'>Your income sources · all time</p></div>
            {dashboardData?.allIncomeBySource?.length ? <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-4'>{dashboardData.allIncomeBySource.map((item, index) => <div key={item.name} className='rounded-xl bg-slate-50 p-4'><div className='mb-3 flex items-center gap-2'><span className='h-2.5 w-2.5 rounded-full' style={{ backgroundColor: COLORS[index % COLORS.length] }} /><p className='truncate text-sm text-slate-500'>{item.name || 'Other'}</p></div><p className='text-xl font-bold text-slate-900'>{money(item.total)}</p></div>)}</div> : <EmptyChart message='Your income source breakdown appears after you add income.' />}
          </section>
        </>}
      </div>
    </DashboardLayout>
  )
}

const EmptyChart = ({ message }) => <div className='flex min-h-32 items-center justify-center rounded-xl bg-slate-50 px-5 text-center text-sm text-slate-500'>{message}</div>

export default Home;