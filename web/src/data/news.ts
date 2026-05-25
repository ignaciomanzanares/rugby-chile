export interface NewsArticle {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  date: string;       // ISO "YYYY-MM-DD"
  author: string;
  featured: boolean;
  body: string;       // Markdown-like paragraphs separated by \n\n
  relatedSlugs?: string[];
}

export const articles: NewsArticle[] = [
  {
    slug: "fecha5-preview-pwcc-cobs",
    title: "Fecha 5: PWCC vs COBS define al nuevo líder — el duelo más esperado de la temporada",
    excerpt:
      "Ambos clubes llegan invictos en puntos con 15 pts el Prince y 18 el COBS. El ganador toma las riendas con autoridad. El sábado 16 de mayo en La Reina se juega el partido del año.",
    category: "Análisis",
    date: "2026-05-15",
    author: "Redacción Top 10",
    featured: true,
    body: `La quinta fecha del ARUSA Top 10 2026 llega cargada de tensión y expectativa. El foco de toda la competencia se posa sobre La Reina, donde el **Prince of Wales Country Club** recibirá al **COBS** en lo que ya se perfila como el cruce de la temporada regular.

**El escenario:** COBS llega como único líder con 18 puntos y cuatro victorias en cuatro fechas — la única escuadra con marca perfecta en el torneo. PWCC lo sigue con 15 puntos, invicto en victorias (3G 1D), tras su dramático triunfo ante Old Mackayans en el minuto 80 de la Fecha 4. Un triunfo del Prince los igualaría en victorias y los llevaría a apenas un punto del liderato; una victoria de COBS los dejaría con seis puntos de ventaja y la tabla prácticamente resuelta a su favor.

**¿Qué esperar del partido?** COBS viene de ganar el Clásico Británico ante Old Boys con el penal de Lucas Sandoval en el minuto 79 — un cierre que le dio al plantel la confianza de quien sabe ganar cuando duele. PWCC, por su parte, tiene en **Iñaki Tuset** a uno de los mejores pateadores del torneo (autor del kick ganador ante Old Macks) y en **Rae Arce** a uno de los backs más desequilibrantes de la competencia.

**Los otros partidos de la fecha:** Old Johns recibe a Stade Francais en un duelo de equipos que buscan consolidarse en la zona media. UC recibe al campeón Old Mackayans en San Carlos de Apoquindo — los Macks necesitan ganar obligatoriamente tras encadenar dos derrotas consecutivas en casa. Old Boys, segundo, visita a Sporting RC con la obligación de sumar de a cuatro para mantener la presión. Y el domingo, Old Reds vs DOBS cierra la fecha con transmisión de 13Go.

**Fecha 5 en números:** cinco partidos, 50 jugadores en el campo, y una tabla que puede lucir muy diferente el domingo a la noche. La recta final de la primera rueda arranca ahora.`,
    relatedSlugs: ["cobs-clasico-britanico-fecha4", "pwcc-gana-ultimo-minuto-macks-fecha4"],
  },

  {
    slug: "cobs-clasico-britanico-fecha4",
    title: "COBS aplastó el drama y se quedó solo en la cima: 22-20 ante Old Boys en el Clásico Británico",
    excerpt:
      "Lucas Sandoval convirtió el penal del triunfo en el minuto 79. La amarilla a Tomás Alvarado en el 72 fue el punto de inflexión. COBS llega a 18 puntos y es el único líder del Top 10.",
    category: "Resultados",
    date: "2026-05-08",
    author: "Redacción Top 10",
    featured: false,
    body: `En uno de los partidos más vibrantes del torneo en años, **COBS se quedó con el Clásico Británico** por 22 a 20 ante Old Boys en el Old Grangonian Club de Colina, y con esa victoria se afianzó como único líder de la Primera Nacional Top 10 2026 con 18 puntos perfectos.

**El guion dramático:** Old Boys fue el equipo que encontró el ritmo en la primera parte. El golpe anímico llegó temprano para los tricolores: en el minuto 13, el apertura titular **Álvaro Castro** sufrió una contusión y tuvo que abandonar el campo, cediendo el lugar a **Mateo Carvajal**. Con todo, la defensa de Old Boys funcionó y su kicker **Tomás Alvarado** sumó tres penales para mantener al equipo con chance de llevarse los cuatro puntos.

COBS abrió el marcador por conducto de **Gonzalo Lara** en el minuto 4, aprovechando un quiebre de Martín de Oto. **Rodrigo Araya** extendió la ventaja poco después del descanso. Pero Old Boys reaccionó: tries de **Benjamín Goñi** (56') y **Vicente Ayarza** (70') con conversiones de Alvarado pusieron a los dueños de casa 20-12 arriba con diez minutos por jugar.

**El quiebre:** en el minuto 72, Alvarado —el hombre que estaba sosteniendo el partido con su bota— vio la tarjeta amarilla. Con 14 hombres, Old Boys no pudo contener el vendaval. **Jorge Araya** se apoyó en el 73' tras un pick-and-go, **Lucas Sandoval** convirtió: 20-19. El clásico se fue a los últimos minutos.

En el 79', COBS consiguió penal en frente de los palos. Sandoval, sin pestañear, puso el 22-20. Tiempo final. El Old Grangonian enmudeció y los azules festejaron solos en la cima.

**Los jugadores:** Rodrigo Araya y Jorge Araya fueron las figuras del COBS. Lucas Sandoval fue el héroe con el nervio de acero en los últimos dos minutos. Por Old Boys, Goñi y Ayarza lo intentaron hasta el final, pero la amarilla al kicker cambió el partido.

**La tabla:** con este resultado, COBS acumula 18 puntos con cuatro victorias en cuatro fechas. Old Boys se mantiene segundo con 15 puntos. El choque entre ambos puede repetirse en playoffs si la tabla confirma lo que el campo ya va diciendo.`,
    relatedSlugs: ["fecha5-preview-pwcc-cobs", "pwcc-gana-ultimo-minuto-macks-fecha4"],
  },

  {
    slug: "pwcc-gana-ultimo-minuto-macks-fecha4",
    title: "PWCC lo ganó en el minuto 80: el hat-trick de Sottovia no le alcanzó a Old Mackayans",
    excerpt:
      "Iñigo Fernández anotó en el tiempo de descuento e Iñaki Tuset convirtió el penal ganador. Old Mackayans, el campeón defensor, pierde por segunda vez seguida de local.",
    category: "Resultados",
    date: "2026-05-10",
    author: "Redacción Top 10",
    featured: false,
    body: `El The Mackay School en Reñaca fue escenario de una auténtica montaña rusa el sábado 10 de mayo. **Old Mackayans recibía al PWCC** con la urgencia de un campeón defensor que necesitaba sacudirse las dudas, y durante 69 minutos todo pareció salir a pedir de boca. Pero el rugby tiene sus propias leyes, y esta vez las escribió **Iñigo Fernández** en el minuto 80.

**El héroe inesperado:** Luis Sottovia construyó uno de los mejores partidos individuales de la temporada. El centro de Old Mackayans anotó un hat-trick — tres tries en el mismo partido — y llegó a su tercer try en el minuto 69 para poner el marcador 26-22 con 11 minutos por jugar. La cancha rugía, los Macks parecían haber sellado la victoria.

**La remontada:** pero PWCC no se rindió. La posesión siguió yendo y viniendo hasta que, en el minuto 80, **Iñigo Fernández** encontró un agujero cerca del maul y se apoyó en el ingoal. El silencio en Reñaca fue total. **Iñaki Tuset** tomó la pelota, midió los palos desde el ángulo y ejecutó la conversión del 29-26. Tiempo final.

**Los números del partido:** los tries fueron marcados por Luis Sottovia (hat-trick, 10', 54', 69') y Franco Scassi-Buffa para Old Mackayans; Lukas Carvallo, Matías Piña, Rae Arce e Iñigo Fernández para PWCC. Tuset fue perfecto desde los palos con cuatro conversiones y un penal.

**El contexto preocupante para Old Macks:** el campeón defensor suma ahora dos derrotas consecutivas de local — primero ante COBS en Fecha 2, ahora ante PWCC en Fecha 4. Es un dato que no puede ignorarse: en 2025 ganaron el título en buena parte gracias a su fortín en Reñaca. ¿Está cambiando la película?

**El nuevo Head Coach:** **Gonzalo "Colo" García**, ex internacional italiano con dos Mundiales (2011 y 2015) en el cuerpo, llegó en el off-season con grandes promesas. Los resultados aún no acompañan. Old Mackayans tiene cuatro finales antes del receso de mitad de año para no quedar fuera de los playoffs.`,
    relatedSlugs: ["gonzalo-garcia-head-coach-macks", "cobs-clasico-britanico-fecha4"],
  },

  {
    slug: "uc-primer-triunfo-dobs-tres-amarillas",
    title: "La UC aprovechó tres amarillas simultáneas de DOBS y consiguió su primer triunfo del año",
    excerpt:
      "Con tres jugadores de DOBS expulsados temporalmente en cuatro minutos, la UC sumó un try de penal y dos tries de campo para voltear el partido. Lladser convirtió doblete.",
    category: "Resultados",
    date: "2026-05-10",
    author: "Redacción Top 10",
    featured: false,
    body: `El rugby tiene una regla tácita que ningún entrenador se cansa de repetir: nunca pierdas más de un jugador al mismo tiempo. El **DOBS** no solo la olvidó — la olvidó tres veces en cuatro minutos, y eso le costó el partido ante la **Universidad Católica**, que se llevó un fundamental 45-28 en el Dunalastair School de Chicureo.

**El partido hasta los 50 minutos:** DOBS llegó mejor al descanso y mantuvo cierto control del partido durante la primera mitad. La UC mostró destellos con **Juan Andrés Lladser** (que anotó su primer try en el minuto 3) y la velocidad de sus backs. El marcador al descanso era ajustado, con DOBS compitiendo.

**Los cuatro minutos que lo cambiaron todo:** en el minuto 50, **Nicolás Álvarez** vio la amarilla. Cuatro minutos después, **Santiago Montan** se sumó al banco de infracción. Y en el 56', **Fernando Sahady** completó el trío con su segunda amarilla de la tarde, lo que generó automáticamente un **try de penal** para la UC. En ese lapso, la Universidad Católica pasó de pelear el partido a tener una superioridad numérica de 15 vs 12.

**La avalancha:** con tres jugadores de más, la UC dominó cada línea de ataque. Lladser anotó su segundo try (59'). **Jorge Delgado** (25'), **Elías Bruchfeld** (29') y **Bastián González** (78') completaron el marcador. DOBS intentó responder — **Renato Arias** anotó dos tries y **Franco Rossi** y **Cristóbal Atenas** también marcaron — pero el daño ya estaba hecho.

**El dato:** este es el primer triunfo de UC en la temporada 2026. Llegaban con tres derrotas consecutivas y una tabla difícil de sostener. Este resultado los lleva a 7 puntos y les da aire para el resto de la primera rueda.

**La enseñanza:** en una competencia donde un bonus point puede definir una clasificación, DOBS no solo perdió el partido sino que probablemente entregó puntos cruciales por falta de control disciplinario en los momentos más delicados.`,
    relatedSlugs: ["cobs-clasico-britanico-fecha4", "pwcc-gana-ultimo-minuto-macks-fecha4"],
  },

  {
    slug: "gonzalo-garcia-head-coach-macks",
    title: "Gonzalo 'Colo' García: el ex internacional italiano con dos Mundiales llega a dirigir a Old Mackayans",
    excerpt:
      "El centro cordobés-italiano, campeón con Benetton Treviso y veterano del RWC 2011 y 2015, llega para reemplazar a Daniel Graco y defender el título conseguido en 2025.",
    category: "Fichajes",
    date: "2026-03-23",
    author: "Redacción Top 10",
    featured: false,
    body: `Old Mackayans, el campeón del Top 10 ARUSA 2025, anunció en marzo a su nuevo Head Coach para la temporada 2026: **Gonzalo "Colo" García**, un nombre que en el rugby europeo necesita pocas presentaciones.

**¿Quién es García?** Nacido en Córdoba, Argentina, pero formado en el rugby italiano, García tuvo una larga carrera como jugador en Italia antes de pasarse a los banquillos. Como centro, representó a la **Nazionale Azzurra** entre 2008 y 2016, acumulando más de 40 caps internacionales y participando en los **Rugby World Cup 2011** (Nueva Zelanda) y **2015** (Inglaterra). Jugó en Benetton Treviso — uno de los clubes más históricos de Italia — y también en **Zebre Parma**, el segundo franquicia italiana en el Pro14.

**La carrera de entrenador:** tras colgar los botines, García siguió ligado al rugby desde el cuerpo técnico. Dirigió las divisiones formativas de Zebre, fue parte del cuerpo técnico de la **Italy Emerging XV** y más recientemente fue Head Coach de **Colorno**, en la Serie A italiana. Su filosofía es la de un rugby de posesión estructurada combinado con una defensa física de línea alta — algo que encaja bien con el ADN histórico de los Macks.

**Por qué Old Mackayans:** "Me dijeron que este es el club más ganador de Chile y que el objetivo es siempre ir por más", declaró García a su llegada. "Venir al país que ganó el bronce en el Mundial 2023 tiene un atractivo especial. El rugby chileno está creciendo y quiero ser parte de ese proceso."

**El desafío:** García llega para reemplazar a **Daniel Graco**, quien comandó el título 2025, y trabajará junto a los asistentes **Agustín Fernández** e **Ignacio López**. La plantilla retiene a piezas clave como **Luis Sottovia** y **Raimundo Maurel**, además de la base juvenil que hizo fuerte al club en los últimos años.

Defender un título es siempre más difícil que ganarlo. Los primeros resultados de 2026 muestran un equipo en construcción, pero con talento de sobra para estar en las semifinales.`,
    relatedSlugs: ["pwcc-gana-ultimo-minuto-macks-fecha4"],
  },

  {
    slug: "clasico-colonias-empate-fecha2",
    title: "El Clásico de las Colonias no defraudó: PWCC y Stade Francais empataron 34-34 en un épico duelo",
    excerpt:
      "El encuentro más viejo del rugby chileno dejó un resultado insólito: 34-34. Nueve tries en total, Iñaki Tuset omnipresente desde los palos. La segunda vuelta promete revancha.",
    category: "Resultados",
    date: "2026-04-19",
    author: "Redacción Top 10",
    featured: false,
    body: `Hay partidos que se recuerdan durante años. El PWCC vs Stade Francais de la Fecha 2 del Top 10 2026 tiene todas las papeletas para ser uno de ellos. El resultado final — **34-34** — lo dice todo: ningún equipo cedió, ninguno se rindió, y el punto compartido se sintió como una victoria para ambos.

**El Clásico de las Colonias:** este encuentro es el derbi más antiguo del rugby chileno, con raíces que se remontan a los primeros años del siglo XX cuando las comunidades británica y francesa de Santiago se desafiaban en los campos de La Reina. Hoy, más de cien años después, el partido sigue siendo una cita que moviliza a ambas hinchadas con una pasión que pocos encuentros del torneo igualan.

**El partido:** nueve tries en total, ida y vuelta permanente, el marcador oscilando a lo largo de los 80 minutos sin que ningún equipo lograra abrir una brecha definitiva. **Iñaki Tuset** (PWCC) fue impecable desde los palos, respondiendo cada try de Stade con conversiones y penales. Por el lado azulblanco, los tres cuartos de Stade Francais encontraron espacio en los costados en varias ocasiones — **Ignacio Silva** e **Joaquín Huici** brillaron en ataque.

**La estadística curiosa:** es el primer empate en el Top 10 ARUSA desde 2022. Ambos equipos se llevan dos puntos, pero en términos de bonus points — y con la mirada puesta en la tabla —, el punto extra podría tener mucho valor en la segunda vuelta si la clasificación se define por detalles.

**La revancha:** cuando se juegue la segunda rueda de este clásico en el Estadio PWCC, ambos equipos llegarán sabiendo que están empatados en el clásico particular de la temporada. Ese partido podría decidir quién va arriba y quién abajo.

**Resumen de tries:** por PWCC marcaron Milesi, Arce y dos más; por Stade Francais, Silva, Huici, Úbeda y compañía. Un espectáculo de rugby abierto que no siempre se ve en los estadios nacionales.`,
    relatedSlugs: ["fecha5-preview-pwcc-cobs", "gonzalo-garcia-head-coach-macks"],
  },
];

export function getArticle(slug: string): NewsArticle | undefined {
  return articles.find((a) => a.slug === slug);
}

export function getRelated(slug: string): NewsArticle[] {
  const article = getArticle(slug);
  if (!article?.relatedSlugs) return [];
  return article.relatedSlugs
    .map((s) => getArticle(s))
    .filter((a): a is NewsArticle => Boolean(a));
}
