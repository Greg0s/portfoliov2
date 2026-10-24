/** Interface strings, in French: the reference every other language must match key for key. */
export const fr = {
  'site.title': 'Grégoire Tinnes',
  'site.description':
    'Entre l’image et le code, je conçois des interfaces et des expériences web interactives, avec autant de soin pour le rendu que pour la technique.',
  'skip.content': 'Aller au contenu',
  'nav.label': 'Navigation principale',
  'nav.projects': 'Projets',
  'nav.contact': 'Contact',
  'menu.open': 'Menu',
  'menu.close': 'Fermer',
  'menu.label': 'Menu',
  'language.fr': 'Français',
  'language.en': 'English',
  'language.label': 'Langue',
  'opening.tagline': 'Je code des images.',
  'placeholder.projects': 'Les huit projets arrivent bientôt.',
  'contact.title': 'On s’écrit ?',
  'notFound.title': 'Page introuvable',
  'notFound.text': 'Cette page n’existe pas, ou plus.',
  'notFound.back': 'Retour à l’accueil',
} as const;

export type Key = keyof typeof fr;
