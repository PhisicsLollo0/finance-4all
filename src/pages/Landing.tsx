import { Link } from 'react-router-dom'

export default function Landing() {
  return (
    <div className="app">
      <section className="landing">
        <div className="landing-card">
          <p className="app-kicker">Finance Simulator Scaffold</p>
          <h1>Finance-4-All</h1>
          <p className="app-subtitle">
            Start with the investment fee simulator to see how costs shape
            long-term growth.
          </p>
          <Link className="primary-button" to="/simulator">
            Open the simulator
          </Link>
        </div>
      </section>
    </div>
  )
}
