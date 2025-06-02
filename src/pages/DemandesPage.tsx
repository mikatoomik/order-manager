interface DemandesPageProps {
  articles: string[];
  setArticles: (a: string[]) => void;
  showModal: boolean;
  setShowModal: (b: boolean) => void;
  catalogue: string[];
}

export default function DemandesPage({ articles, setArticles, showModal, setShowModal, catalogue }: DemandesPageProps) {
  return (
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
            const select = (e.target as HTMLFormElement).elements.namedItem('article-select') as HTMLSelectElement;
            setArticles([...articles, select.value]);
            setShowModal(false);
          }}>
            <label htmlFor="article-select">Article</label>
            <select id="article-select" name="article-select" aria-label="Article" defaultValue={catalogue[0] || ''}>
              {catalogue.map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
            <button type="submit">Valider</button>
          </form>
        </div>
      )}
    </div>
  )
}
