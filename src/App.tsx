import Analyzer from './components/Analyzer.jsx'
import History from './components/History.jsx'

export default function App() {
  return (
    <div className="container">
      <header className="header">
        <div className="h1">SafeLink Inspector</div>
        <span className="badge">Antot_12</span>
      </header>

      <div className="grid">
        <div>
          <Analyzer />
        </div>
        <div>
          <History />
        </div>
      </div>
    </div>
  )
}
