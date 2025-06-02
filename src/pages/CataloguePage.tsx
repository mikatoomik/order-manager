interface CataloguePageProps {
  catalogue: string[];
  articles: string[];
  setArticles: (a: string[]) => void;
}

export default function CataloguePage({ catalogue, articles, setArticles }: CataloguePageProps) {
  return (
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
  )
}
