import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { addPerson, deletePerson, listPersons, rebuildIndex } from '../services/api'

export function useBlacklist() {
  const [persons, setPersons] = useState([])
  const [loading, setLoading] = useState(false)
  const [totalEmbeddings, setTotalEmbeddings] = useState(0)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listPersons()
      setPersons(data.persons || [])
      setTotalEmbeddings(data.total_embeddings || 0)
    } catch (err) {
      toast.error('Failed to load blacklist')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const addNew = useCallback(async (name, files, onProgress) => {
    const result = await addPerson(name, files, onProgress)
    await refresh()
    return result
  }, [refresh])

  const remove = useCallback(async (name) => {
    await deletePerson(name)
    setPersons(prev => prev.filter(p => p.name !== name))
    toast.success(`${name} removed from blacklist`)
  }, [])

  const rebuild = useCallback(async () => {
    const result = await rebuildIndex()
    await refresh()
    return result
  }, [refresh])

  return { persons, loading, totalEmbeddings, refresh, addNew, remove, rebuild }
}
