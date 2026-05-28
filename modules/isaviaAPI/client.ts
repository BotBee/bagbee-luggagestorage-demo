import axios, { AxiosInstance } from 'axios'

const api: AxiosInstance = axios.create({
  timeout: 5000,
  baseURL: 'https://www.isavia.is/json',
  headers: {
    'content-type': 'application/json',
  },
})

export const api2: AxiosInstance = axios.create({
  timeout: 5000,
  baseURL: 'https://www.kefairport.is/',
  headers: {
    'content-type': 'application/json',
  },
})

export default api
