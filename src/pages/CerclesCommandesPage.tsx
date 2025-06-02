import type { User } from '@supabase/supabase-js'
import type { UserCircle } from '../testData'
import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

interface CerclesCommandesPageProps {
  user: User;
  userCircles: UserCircle[];
}

interface CommandeCercle {
  id: string;
  status: string;
  period: { nom: string; date_limite: string } | null;
  articles: { libelle: string; qty: number }[];
}

export default function CerclesCommandesPage({ user, userCircles }: CerclesCommandesPageProps) {
  const [commandes, setCommandes] = useState<Record<string, CommandeCercle | null>>({});
  const [periode, setPeriode] = useState<{ id: string; nom: string; date_limite: string } | null>(null);

  // Récupère la période en cours (status = 'open')
  useEffect(() => {
    supabase.from('order_periods').select('id, nom, date_limite').eq('status', 'open').order('date_limite', { ascending: true }).limit(1).then(({ data }) => {
      setPeriode(data && data[0] ? data[0] : null);
    });
  }, []);

  // Récupère les commandes pour chaque cercle de l'utilisateur pour la période en cours
  useEffect(() => {
    if (!periode) return;
    userCircles.forEach(cercle => {
      supabase
        .from('circle_requests')
        .select('id, status, order_periods(nom, date_limite), request_lines(qty, articles(libelle))')
        .eq('circle_id', cercle.id)
        .eq('period_id', periode.id)
        .then(({ data }) => {
          if (data && data[0]) {
            setCommandes(cmds => ({
              ...cmds,
              [cercle.nom]: {
                id: data[0].id,
                status: data[0].status,
                period: data[0].order_periods,
                articles: (data[0].request_lines || []).map((l: any) => ({
                  libelle: l.articles?.libelle || '',
                  qty: l.qty || 0,
                })),
              },
            }));
          } else {
            setCommandes(cmds => ({ ...cmds, [cercle.nom]: null }));
          }
        });
    });
  }, [userCircles, periode]);

  return (
    <div>
      <h1>Commandes par cercle (période en cours)</h1>
      {periode ? (
        <>
          <p>Période : <b>{periode.nom}</b> (jusqu'au {periode.date_limite})</p>
          <div style={{ display: 'flex', gap: 32 }}>
            {userCircles.map(cercle => (
              <div key={cercle.nom} style={{ border: '1px solid #ccc', borderRadius: 8, padding: 16, minWidth: 220 }}>
                <h2>{cercle.nom}</h2>
                {commandes[cercle.nom] ? (
                  <>
                    <p>Statut : <b>{commandes[cercle.nom]?.status}</b></p>
                    <ul>
                      {commandes[cercle.nom]?.articles.map((a, i) => (
                        <li key={i}>{a.libelle} × {a.qty}</li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p>Aucune commande pour cette période</p>
                )}
              </div>
            ))}
          </div>
        </>
      ) : (
        <p>Aucune période en cours</p>
      )}
    </div>
  );
}
