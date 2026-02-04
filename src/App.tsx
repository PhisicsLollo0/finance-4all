import { Routes, Route } from 'react-router-dom'
import {
  ActionIcon,
  Tooltip,
  useComputedColorScheme,
  useMantineColorScheme,
} from '@mantine/core'
import { IconMoon, IconSun } from '@tabler/icons-react'
import Landing from './pages/Landing'
import Simulator from './pages/Simulator'
import './App.css'

function App() {
  const { toggleColorScheme } = useMantineColorScheme()
  const computedScheme = useComputedColorScheme('light')
  const isDark = computedScheme === 'dark'
  const toggleLabel = isDark ? 'Light mode' : 'Dark mode'

  return (
    <div>
      <Tooltip label={toggleLabel} position="left">
        <ActionIcon
          variant="subtle"
          size="lg"
          aria-label={`Switch to ${toggleLabel.toLowerCase()}`}
          onClick={() => toggleColorScheme()}
          style={{ position: 'fixed', top: 24, right: 24, zIndex: 1000 }}
        >
          {isDark ? <IconSun size={18} /> : <IconMoon size={18} />}
        </ActionIcon>
      </Tooltip>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/simulator" element={<Simulator />} />
      </Routes>
    </div>
  )
}

export default App
