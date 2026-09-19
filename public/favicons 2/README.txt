Skewvy modular S favicon

Concept
The white S is assembled from simplified subjects that Skewvy can measure: a show ticket, a person, a public story card, a school/institution, and a city/organisation. The pieces form one S at a glance. A hard black offset copy behind the pieces creates the neo-brutalist shadow treatment on a carrot-orange field.

Files
favicon.svg — scalable source and preferred browser favicon
favicon.ico — 16, 32, and 48 pixel fallback
favicon-16.png — browser-size PNG
favicon-32.png — high-density browser PNG
apple-touch-icon.png — 180 pixel home-screen icon
skewvy-icon-512.png — full-resolution app icon

Next.js App Router
Rename favicon.svg to icon.svg and place icon.svg, favicon.ico, and apple-touch-icon.png in the app directory.

Other frameworks
Place the files in public and add:
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="icon" sizes="any" href="/favicon.ico">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
