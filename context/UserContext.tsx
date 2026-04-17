import {
  ReactElement,
  createContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

type UserContextProps = {
  referrer: string
}

export const UserContext = createContext<Partial<UserContextProps>>({})

/**
 * The only purpose of this Context Provider is to capture the document.referrer
 * value to insert into Airtable. Can be expanded if need.
 */
export const UserContextProvider: React.FC<{ children: ReactElement }> = ({
  children,
}) => {
  const [referrer, setReferrer] = useState('')
  useEffect(() => {
    setReferrer(document.referrer)
  }, [])
  const value = useMemo(
    () => ({
      referrer,
    }),
    [referrer]
  )
  return <UserContext.Provider value={value}>{children}</UserContext.Provider>
}
