import type { FeedStatement } from "./types";

/**
 * Cartes servies quand Supabase n'est pas configure ou injoignable :
 * l'app reste jouable en local sans aucune cle.
 */
export const DEMO_STATEMENTS: FeedStatement[] = [
  {
    id: "demo-1",
    text: "Mettre de l'ananas sur une pizza est un crime.",
    text_language: "fr",
    translations: {
      fr: "Mettre de l'ananas sur une pizza est un crime.",
      en: "Putting pineapple on pizza is a crime.",
      es: "Poner pina en la pizza es un crimen.",
    },
    image_url: "https://picsum.photos/seed/pizza/800/1200",
    votes_agree: 412,
    votes_disagree: 588,
  },
  {
    id: "demo-2",
    text: "On devrait travailler 4 jours par semaine.",
    text_language: "fr",
    translations: {
      fr: "On devrait travailler 4 jours par semaine.",
      en: "We should work four days a week.",
      es: "Deberiamos trabajar cuatro dias a la semana.",
    },
    image_url: "https://picsum.photos/seed/work/800/1200",
    votes_agree: 1720,
    votes_disagree: 240,
  },
  {
    id: "demo-3",
    text: "Les chats sont meilleurs que les chiens.",
    text_language: "fr",
    translations: {
      fr: "Les chats sont meilleurs que les chiens.",
      en: "Cats are better than dogs.",
      es: "Los gatos son mejores que los perros.",
    },
    image_url: "https://picsum.photos/seed/cat/800/1200",
    votes_agree: 690,
    votes_disagree: 710,
  },
  {
    id: "demo-4",
    text: "Les series sont devenues meilleures que le cinema.",
    text_language: "fr",
    translations: {
      fr: "Les series sont devenues meilleures que le cinema.",
      en: "TV shows have become better than movies.",
      es: "Las series se han vuelto mejores que el cine.",
    },
    image_url: "https://picsum.photos/seed/cinema/800/1200",
    votes_agree: 830,
    votes_disagree: 470,
  },
  {
    id: "demo-5",
    text: "Repondre a un message pro le week-end, c'est non.",
    text_language: "fr",
    translations: {
      fr: "Repondre a un message pro le week-end, c'est non.",
      en: "Answering work messages on the weekend is a no.",
      es: "Responder mensajes de trabajo el fin de semana es no.",
    },
    image_url: "https://picsum.photos/seed/weekend/800/1200",
    votes_agree: 1540,
    votes_disagree: 160,
  },
  {
    id: "demo-6",
    text: "Le petit dejeuner est le repas le plus surestime.",
    text_language: "fr",
    translations: {
      fr: "Le petit dejeuner est le repas le plus surestime.",
      en: "Breakfast is the most overrated meal.",
      es: "El desayuno es la comida mas sobrevalorada.",
    },
    image_url: "https://picsum.photos/seed/breakfast/800/1200",
    votes_agree: 380,
    votes_disagree: 920,
  },
];
