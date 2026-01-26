import React, { useState } from 'react'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import Overview from '../../pages/Overview'
import Tasks from '../../pages/Tasks'
import Skills from '../../pages/Skills'
import MCPs from '../../pages/MCPs'

const MainLayout: React.FC = () => {
  const [activeNav, setActiveNav] = useState('overview')

  const renderContent = () => {
    switch (activeNav) {
      case 'overview':
        return <Overview />
      case 'tasks':
        return <Tasks />
      case 'skills':
        return <Skills />
      case 'mcps':
        return <MCPs />
      default:
        return <Overview />
    }
  }

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#FFFFFF'
      }}
    >
      <TopBar />
      <div style={{ display: 'flex', height: 'calc(100vh - 60px)' }}>
        <Sidebar activeNav={activeNav} onNavChange={setActiveNav} />
        <div
          style={{
            flex: 1,
            backgroundColor: '#FFFFFF',
            padding: '40px 48px',
            overflowY: 'auto'
          }}
        >
          {renderContent()}
        </div>
      </div>
    </div>
  )
}

export default MainLayout
