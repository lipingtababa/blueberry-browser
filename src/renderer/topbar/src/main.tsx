import React from 'react'
import ReactDOM from 'react-dom/client'
import { TopBarApp } from './TopBarApp'
import { setupRendererLogging } from '../../lib/logger'
import './index.css'

// Setup logging to file
setupRendererLogging()

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <TopBarApp />
    </React.StrictMode>
)

