import { supabase } from '../supabaseClient';

export interface Period {
  id: string;
  nom: string;
  date_limite: string;
  status: 'open' | 'closed' | 'ordered' | 'archived';
}

/**
 * Détermine la période en cours (1-15 ou 16-fin du mois)
 * @returns Objet contenant les dates de début et fin de la période, ainsi que son nom formaté
 */
export function getCurrentPeriod(): { start: Date; end: Date; name: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const day = now.getDate();
  
  // Première ou deuxième quinzaine
  if (day <= 15) {
    const start = new Date(year, month, 1);
    const end = new Date(year, month, 15);
    return {
      start,
      end,
      name: `${start.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })} - ${end.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}`
    };
  } else {
    const start = new Date(year, month, 16);
    const end = new Date(year, month + 1, 0); // Dernier jour du mois
    return {
      start,
      end,
      name: `${start.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })} - ${end.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}`
    };
  }
}

/**
 * Récupère l'enregistrement de période correspondant à la période en cours
 * @returns Promise contenant l'objet Period ou null en cas d'erreur
 */
export async function getCurrentPeriodRecord(): Promise<Period | null> {
  const period = getCurrentPeriod();
  const { data, error } = await supabase
    .from('order_periods')
    .select('*')
    .eq('nom', period.name)
    .limit(1);
  if (error) {
    console.error('Erreur lors de la recherche de la période:', error);
    return null;
  }
  if (data && data.length > 0) return data[0];
  return null;
}

export function getNextPeriod(): { start: Date; end: Date; name: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const day = now.getDate();
  let start, end;
  if (day <= 15) {
    // Prochaine période = 16-fin du mois
    start = new Date(year, month, 16);
    end = new Date(year, month + 1, 0);
  } else {
    // Prochaine période = 1-15 du mois suivant
    start = new Date(year, month + 1, 1);
    end = new Date(year, month + 1, 15);
  }
  return {
    start,
    end,
    name: `${start.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })} - ${end.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}`
  };
}

export async function createNextPeriodIfNeeded(): Promise<Period | null> {
  const next = getNextPeriod();
  const { data, error } = await supabase
    .from('order_periods')
    .select('*')
    .eq('nom', next.name)
    .limit(1);
  if (error) {
    console.error('Erreur lors de la recherche de la prochaine période:', error);
    return null;
  }
  if (data && data.length > 0) return data[0];
  // Créer la prochaine période
  const { data: newPeriod, error: createError } = await supabase
    .from('order_periods')
    .insert([
      {
        nom: next.name,
        date_limite: next.end.toISOString().split('T')[0],
        status: 'open'
      }
    ])
    .select()
    .single();
  if (createError) {
    console.error('Erreur lors de la création de la prochaine période:', createError);
    return null;
  }
  return newPeriod;
}