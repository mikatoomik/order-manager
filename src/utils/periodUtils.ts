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
 * Récupère ou crée l'enregistrement de période correspondant à la période en cours
 * @returns Promise contenant l'objet Period ou null en cas d'erreur
 */
export async function getOrCreatePeriodRecord(): Promise<Period | null> {
  const period = getCurrentPeriod();
  
  // Vérifier si la période existe déjà
  const { data } = await supabase
    .from('order_periods')
    .select('*')
    .eq('nom', period.name)
    .single();
  
  if (data) return data;
  
  // Créer la période si elle n'existe pas
  const { data: newPeriod, error: createError } = await supabase
    .from('order_periods')
    .insert([
      {
        nom: period.name,
        date_limite: period.end.toISOString().split('T')[0],
        status: 'open'
      }
    ])
    .select()
    .single();
  
  if (createError) {
    console.error('Erreur lors de la création de la période:', createError);
    return null;
  }
  
  return newPeriod;
}