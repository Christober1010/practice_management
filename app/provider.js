'use client'

import { Provider } from 'react-redux'
import { store } from './store'
import { Toaster } from 'react-hot-toast'

export default function Providers({ children }) {
  return (
    <Provider store={store}>
      {children}
      <Toaster />
    </Provider>
  )
}
