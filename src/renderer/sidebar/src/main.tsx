import React from 'react'
import ReactDOM from 'react-dom/client'
import { SidebarApp } from './SidebarApp'
import { setupRendererLogging } from '../../lib/logger'
import './index.css'

// Setup logging to file
setupRendererLogging()

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <SidebarApp />
    </React.StrictMode>
)

