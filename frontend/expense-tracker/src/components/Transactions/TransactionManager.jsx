import { useCallback, useEffect, useMemo, useState } from 'react'
import { LuArrowDownToLine, LuCalendarDays, LuPlus, LuSearch, LuTrash2, LuWallet } from 'react-icons/lu'
import DashboardLayout from '../Layout/DashboardLayout'
import { useUserAuth } from '../../hooks/useUserAuth'
import { API_PATHS } from '../../utils/apiPaths'
import axiosInstance from '../../utils/axiosinstance'

const EXPENSE_CATEGORIES = ['Food & dining', 'Shopping', 'Transport', 'Bills & utilities', 'Health', 'Entertainment', 'Travel', 'Other']
const INCOME_SOURCES = ['Salary', 'Freelance', 'Business', 'Investment', 'Gift', 'Other']
const today = () => {
  const date = new Date()
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 10)
}
const currency = (value) => new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', maximumFractionDigits: 2,
}).format(Number(value) || 0)
const prettyDate = (value) => new Date(value).toLocaleDateString(undefined, {
  month: 'short', day: 'numeric', year: 'numeric',
})

const TransactionManager = ({ type }) => {
  useUserAuth()
  const isIncome = type === 'income'
  const title = isIncome ? 'Income' : 'Expenses'
  const fieldLabel = isIncome ? 'Income source' : 'Expense category'
  const listPath = isIncome ? API_PATHS.INCOME.GET_ALL_INCOME : API_PATHS.EXPENSE.GET_ALL_EXPENSE
  const addPath = isIncome ? API_PATHS.INCOME.ADD_INCOME : API_PATHS.EXPENSE.ADD_EXPENSE
  const downloadPath = isIncome ? API_PATHS.INCOME.DOWNLOAD_INCOME : API_PATHS.EXPENSE.DOWNLOAD_EXPENSE
  const deletePath = isIncome ? API_PATHS.INCOME.DELETE_INCOME : API_PATHS.EXPENSE.DELETE_EXPENSE
  const choices = isIncome ? INCOME_SOURCES : EXPENSE_CATEGORIES

  const [transactions, setTransactions] = useState([])
  const [form, setForm] = useState({ name: '', amount: '', date: today(), icon: '' })
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const fetchTransactions = useCallback(async () => {
    try {
      const response = await axiosInstance.get(listPath)
      setTransactions(Array.isArray(response.data) ? response.data : [])
      setError('')
    } catch (requestError) {
      setError(requestError.response?.data?.message || `Couldn't load ${title.toLowerCase()}. Please try again.`)
    } finally {
      setLoading(false)
    }
  }, [listPath, title])

  useEffect(() => {
    let active = true
    axiosInstance.get(listPath).then((response) => {
      if (active) setTransactions(Array.isArray(response.data) ? response.data : [])
    }).catch((requestError) => {
      if (active) setError(requestError.response?.data?.message || `Couldn't load ${title.toLowerCase()}. Please try again.`)
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [listPath, title])

  const visibleTransactions = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return transactions
    return transactions.filter((item) => (isIncome ? item.source : item.category)?.toLowerCase().includes(query))
  }, [transactions, search, isIncome])

  const thisMonthTotal = transactions.reduce((sum, item) => {
    const date = new Date(item.date)
    const now = new Date()
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
      ? sum + Number(item.amount || 0)
      : sum
  }, 0)
  const total = transactions.reduce((sum, item) => sum + Number(item.amount || 0), 0)

  const handleSubmit = async (event) => {
    event.preventDefault()
    const amount = Number(form.amount)
    if (!form.name.trim() || !Number.isFinite(amount) || amount <= 0 || !form.date) {
      setError('Enter a description, a valid amount greater than zero, and a date.')
      return
    }

    setSaving(true)
    setError('')
    setMessage('')
    try {
      const payload = {
        [isIncome ? 'source' : 'category']: form.name.trim(),
        amount,
        date: form.date,
        ...(isIncome ? {} : { icon: form.icon || '🧾' }),
      }
      await axiosInstance.post(addPath, payload)
      setForm({ name: '', amount: '', date: today(), icon: '' })
      setMessage(`${isIncome ? 'Income' : 'Expense'} added.`)
      await fetchTransactions()
    } catch (requestError) {
      setError(requestError.response?.data?.message || `Couldn't save this ${isIncome ? 'income' : 'expense'}.`)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm(`Delete this ${isIncome ? 'income' : 'expense'} entry?`)) return
    setError('')
    try {
      await axiosInstance.delete(deletePath(id))
      setTransactions((current) => current.filter((item) => item._id !== id))
      setMessage(`${isIncome ? 'Income' : 'Expense'} deleted.`)
    } catch (requestError) {
      setError(requestError.response?.data?.message || `Couldn't delete this ${isIncome ? 'income' : 'expense'}.`)
    }
  }

  const handleDownload = async () => {
    try {
      const response = await axiosInstance.get(downloadPath, { responseType: 'blob' })
      const fileUrl = URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = fileUrl
      link.download = `${isIncome ? 'income' : 'expense'}_details.xlsx`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(fileUrl)
    } catch {
      setError(`Couldn't download ${title.toLowerCase()}. Please try again.`)
    }
  }

  return (
    <DashboardLayout activeMenu={isIncome ? 'Income' : 'Expense'}>
      <div className="mx-auto max-w-7xl space-y-6 py-2">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-violet-600">Your money, in focus</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">{title}</h1>
            <p className="mt-1 text-sm text-slate-500">Add, review, and export your {title.toLowerCase()} activity.</p>
          </div>
          <button onClick={handleDownload} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-violet-300 hover:text-violet-700">
            <LuArrowDownToLine /> Export Excel
          </button>
        </header>

        {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
        {message && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</p>}

        <section className="grid gap-4 sm:grid-cols-3">
          <div className={`rounded-2xl p-5 text-white ${isIncome ? 'bg-gradient-to-br from-emerald-500 to-teal-600' : 'bg-gradient-to-br from-rose-500 to-orange-500'}`}>
            <div className="flex items-center justify-between"><p className="text-sm text-white/80">All-time total</p><LuWallet className="text-xl" /></div>
            <p className="mt-3 text-3xl font-bold">{currency(total)}</p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">This month</p><p className="mt-3 text-3xl font-bold text-slate-900">{currency(thisMonthTotal)}</p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Entries recorded</p><p className="mt-3 text-3xl font-bold text-slate-900">{transactions.length}</p>
          </div>
        </section>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.5fr)]">
          <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-5 flex items-center gap-3">
              <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${isIncome ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}><LuPlus /></span>
              <div><h2 className="font-semibold text-slate-900">Add {isIncome ? 'income' : 'expense'}</h2><p className="text-xs text-slate-500">Fill in the details below</p></div>
            </div>
            <label className="mb-2 block text-sm font-medium text-slate-700">{fieldLabel}</label>
            <input
              list={`${type}-choices`}
              required
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder={isIncome ? 'e.g. Salary' : 'e.g. Groceries'}
              className="mb-4 w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
            />
            <datalist id={`${type}-choices`}>{choices.map((choice) => <option key={choice} value={choice} />)}</datalist>
            {!isIncome && <>
              <label className="mb-2 block text-sm font-medium text-slate-700">Icon (optional)</label>
              <input value={form.icon} onChange={(event) => setForm({ ...form, icon: event.target.value })} maxLength={8} placeholder="🧾" className="mb-4 w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-100" />
            </>}
            <label className="mb-2 block text-sm font-medium text-slate-700">Amount</label>
            <div className="mb-4 flex items-center rounded-xl border border-slate-200 px-3.5 focus-within:border-violet-400 focus-within:ring-4 focus-within:ring-violet-100">
              <span className="text-sm text-slate-400">$</span>
              <input type="number" min="0.01" step="0.01" required value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} placeholder="0.00" className="w-full bg-transparent px-2 py-3 text-sm outline-none" />
            </div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Date</label>
            <div className="mb-5 flex items-center gap-2 rounded-xl border border-slate-200 px-3.5 focus-within:border-violet-400 focus-within:ring-4 focus-within:ring-violet-100">
              <LuCalendarDays className="shrink-0 text-slate-400" /><input type="date" required value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} className="w-full bg-transparent py-3 text-sm outline-none" />
            </div>
            <button disabled={saving} className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white transition disabled:cursor-wait disabled:opacity-60 ${isIncome ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-violet-600 hover:bg-violet-700'}`}>
              <LuPlus /> {saving ? 'Saving…' : `Add ${isIncome ? 'income' : 'expense'}`}
            </button>
          </form>

          <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
            <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div><h2 className="font-semibold text-slate-900">{title} history</h2><p className="mt-1 text-xs text-slate-500">{visibleTransactions.length} {visibleTransactions.length === 1 ? 'entry' : 'entries'}</p></div>
              <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-slate-400 focus-within:border-violet-400">
                <LuSearch /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${title.toLowerCase()}`} className="w-full bg-transparent text-sm text-slate-700 outline-none sm:w-44" />
              </label>
            </div>
            {loading ? <div className="p-8 text-center text-sm text-slate-500">Loading {title.toLowerCase()}…</div> : visibleTransactions.length === 0 ? (
              <div className="px-6 py-14 text-center"><span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400"><LuWallet /></span><p className="mt-4 font-medium text-slate-800">{search ? 'No matches found' : `No ${title.toLowerCase()} yet`}</p><p className="mt-1 text-sm text-slate-500">{search ? 'Try a different search term.' : 'Your entries will appear here once you add them.'}</p></div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {visibleTransactions.map((item) => <li key={item._id} className="flex items-center gap-3 px-5 py-4 transition hover:bg-slate-50/70 sm:gap-4">
                  <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg ${isIncome ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{isIncome ? '↗' : (item.icon || '🧾')}</span>
                  <div className="min-w-0 flex-1"><p className="truncate font-medium text-slate-800">{isIncome ? item.source : item.category}</p><p className="mt-1 text-xs text-slate-500">{prettyDate(item.date)}</p></div>
                  <p className={`whitespace-nowrap text-sm font-semibold sm:text-base ${isIncome ? 'text-emerald-600' : 'text-slate-900'}`}>{isIncome ? '+' : '−'}{currency(item.amount)}</p>
                  <button aria-label={`Delete ${isIncome ? item.source : item.category}`} onClick={() => handleDelete(item._id)} className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"><LuTrash2 /></button>
                </li>)}
              </ul>
            )}
          </section>
        </div>
      </div>
    </DashboardLayout>
  )
}

export default TransactionManager
