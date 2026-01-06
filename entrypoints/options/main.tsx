import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { AppProvider } from '@/providers/app-provider'
import App from './options-app'
import './style.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
	<React.StrictMode>
		<HashRouter>
			<AppProvider withToaster={true} className="h-full">
				<App />
			</AppProvider>
		</HashRouter>
	</React.StrictMode>
)
