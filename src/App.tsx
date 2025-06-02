import { useState } from 'react'
import './App.css'

function App() {
  const [showLogin, setShowLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [isLogged, setIsLogged] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [articles, setArticles] = useState<string[]>([])
  const [page, setPage] = useState<'demandes' | 'catalogue'>('demandes')
  // Catalogue fictif
  const catalogue = ['article-1', 'article-2']

  return (
    <div style={{ padding: 32 }}>
      {showLogin && !isLogged && (
        <div>
          <button onClick={() => setShowLogin(false)} aria-label="Se connecter">Se connecter</button>
        </div>
      )}
      {!showLogin && !isLogged && (
        <form onSubmit={e => { e.preventDefault(); setIsLogged(true); }}>
          <label htmlFor="email">Email</label>
          <input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} />
          <button type="submit">Envoyer le lien</button>
        </form>
      )}
      {isLogged && (
        <div>
          <nav style={{ marginBottom: 16 }}>
            <a href="#" onClick={e => { e.preventDefault(); setPage('demandes'); }} role="link">Mes demandes</a> |
            <a href="#" onClick={e => { e.preventDefault(); setPage('catalogue'); }} role="link">Catalogue</a>
          </nav>
          {page === 'demandes' && (
            <div>
              <h1>Mes demandes</h1>
              {articles.length === 0 ? (
                <p>Aucune demande</p>
              ) : (
                <ul>
                  {articles.map(a => <li key={a}>{a}</li>)}
                </ul>
              )}
              <button onClick={() => setShowModal(true)}>Ajouter un article</button>
              {showModal && (
                <div role="dialog" style={{ background: '#fff', border: '1px solid #ccc', padding: 16, marginTop: 16 }}>
                  <form onSubmit={e => {
                    e.preventDefault();
                    setArticles([...articles, 'article-1']);
                    setShowModal(false);
                  }}>
                    <label htmlFor="article-select">Article</label>
                    <select id="article-select" aria-label="Article" defaultValue="article-1">
                      <option value="article-1">article-1</option>
                    </select>
                    <button type="submit">Valider</button>
                  </form>
                </div>
              )}
            </div>
          )}
          {page === 'catalogue' && (
            <div>
              <h1>Catalogue</h1>
              <ul>
                {catalogue.map(a => (
                  <li key={a}>
                    {a} <button onClick={() => setArticles([...articles, a])}>Ajouter {a}</button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default App
