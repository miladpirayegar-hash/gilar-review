import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, HashRouter } from 'react-router-dom'
import App from './App'
import './styles.css'

const reviewMode = import.meta.env.VITE_GILAR_MODE === 'review'
const Router = reviewMode ? HashRouter : BrowserRouter
const basename = reviewMode || import.meta.env.BASE_URL === '/' ? undefined : import.meta.env.BASE_URL.replace(/\/$/, '')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Router basename={basename}>
      <App />
    </Router>
  </React.StrictMode>,
)
