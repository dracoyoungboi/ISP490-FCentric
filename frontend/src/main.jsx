import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'    
import App from './App.jsx'
import { batTheoDoiCamUng } from './lib/camUng'

batTheoDoiCamUng()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
