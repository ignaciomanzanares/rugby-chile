// AUTO-SEEDED player positions — arusaId -> rugby position.
//
// ARUSA does not publish positions, so these were seeded from each player’s
// stats (goal-kickers -> FLY_HALF/FULLBACK, try-scorers -> WING/CENTRE, the
// rest distributed across the pack by a stable hash). They are a STARTING
// POINT: correct any wrong ones by hand — just edit the value. Players with no
// entry fall back to a derived position at runtime.

import type { Position } from "@/lib/fantasy";

export const PLAYER_POSITIONS: Record<string, Position> = {
  // ── PRIMERA ──
  // COBS
  "54168108": "NUMBER_8", // Benjamin Sandoval
  "54168101": "FLANKER", // Benjamín Escobedo
  "54168222": "PROP", // Diego Lagos Pimstein
  "54167817": "CENTER", // Eduardo Antonio Orpis Ramírez
  "54168132": "FLY_HALF", // Franco Costantino Roger
  "54189004": "FLY_HALF", // Gonzalo Lara Mehech
  "54168250": "PROP", // Ignacio Soublette
  "54168252": "SCRUM_HALF", // Jan Hasenlechner
  "54168253": "NUMBER_8", // Jorge Araya Morales
  "54168278": "HOOKER", // José Ignacio Escobedo Leiva
  "54168258": "CENTER", // Juan Pablo Beheran Castro
  "54168122": "CENTER", // Lucas Sandoval Pino
  "54168118": "NUMBER_8", // Martin De Oto Davids
  "54168127": "FLY_HALF", // Martin Escobar
  "54168193": "WING", // Rodrigo Araya
  "54168185": "FULLBACK", // SEBASTIAN GONZALEZ REISS
  "54168186": "CENTER", // SEBASTIAN GONZALEZ REISS
  "54168162": "HOOKER", // Vicente Codorniu
  "54167824": "SCRUM_HALF", // Vicente Contreras
  // DOBS
  "54158490": "LOCK", // Andro Kovacic
  "54200312": "PROP", // Clemente Armstrong Rios
  "54162583": "CENTER", // Cristobal Rene Lagos Nazal
  "54158498": "CENTER", // Cristobal serrano roman
  "54158505": "CENTER", // Diego Zamora fantuzzi
  "54158489": "SCRUM_HALF", // Domingo Montan Moreno
  "54158491": "PROP", // Fernando Javier Sahady Molina
  "54158494": "WING", // Franco Rossi Santibañez
  "54158487": "CENTER", // Gonzalo Cordova Diemer
  "54158506": "CENTER", // Ignacio Arias Rivera
  "54162576": "FLY_HALF", // Ignacio Giacaman Sabal
  "54162604": "WING", // Jordi Sancho
  "54162585": "FLY_HALF", // Martin Leiva
  "54162582": "LOCK", // Nicolas Alvarez Romo
  "54158486": "LOCK", // Pedro Pablo Arias Rivera
  "54158492": "CENTER", // Renato Sebastian Arias Rivera
  "54162581": "SCRUM_HALF", // Roberto Melo Zolezzi
  "54162584": "WING", // Santiago Montan Moreno
  "54200315": "LOCK", // benjamin moreno millas
  "54158488": "FLY_HALF", // cristobal atenas parra
  "54162589": "LOCK", // joaquin cornejo calaf
  "54162579": "CENTER", // joseph uauy zirinsky
  // Old Boys
  "54164720": "FLY_HALF", // Alvaro Castro Ulloa
  "54144637": "CENTER", // Antonio Andrés Bozzolo Kullmer
  "54144881": "WING", // Antonio Corbella Feliu
  "54144886": "CENTER", // Benjamín Goñi Hartard
  "54159147": "WING", // Clemente Bustamante Fernandez
  "54189595": "FULLBACK", // Federico Kennedy
  "54144920": "CENTER", // Gabriel Ljubetic Carzoglio
  "54144934": "PROP", // Ian Otersen Kanaan
  "54144956": "PROP", // Jose Tomas Silva Lobo
  "54164468": "FLANKER", // Lucas Haddad Domingo
  "54145235": "WING", // Mateo Carvajal
  "54158978": "CENTER", // Mauro Saez
  "54145237": "SCRUM_HALF", // Maximiliano De Peña De Marinis
  "54158929": "CENTER", // Nicolas Ovalle Norambuena
  "54161202": "CENTER", // Nicolas Yañez Ureta
  "54158967": "NUMBER_8", // Santiago Ostornol
  "54145070": "WING", // Sebastian Valech Alonso
  "54145258": "LOCK", // Tomas Andres Alvarado Duclos
  "54145262": "LOCK", // Vicente Ayarza Saporta
  // Old Johns
  "54168453": "CENTER", // Agustin Alonso Game Jimenez
  "54168458": "FLY_HALF", // Aldair Márquez cahuana
  "54168461": "HOOKER", // Allen Felipe Ruminot Cabezas
  "54189864": "SCRUM_HALF", // Benjamin Soto Besamat
  "54168459": "FLY_HALF", // Claudio Roa Benavente
  "54168455": "CENTER", // Cristobal Martinez Estay
  "54168463": "HOOKER", // Daivis Leonel Alejandro Guzman Rodriguez
  "54189865": "FLY_HALF", // Diego Pierart
  "54168505": "FLANKER", // FELIPE ANDRES MENDEZ LAZCANO
  "54168475": "PROP", // Fabian Andre Lagos Figueroa
  "54168486": "LOCK", // Francisco Rivas Urra
  "54168472": "LOCK", // Gonzalo Andrés Reyes Jofré
  "54168479": "PROP", // Gonzalo Sepulveda Manquecura
  "54168513": "WING", // Joaquín Enríquez
  "54168457": "NUMBER_8", // Joaquín Ignacio Dibán Herrera
  "54168498": "PROP", // Juan Pablo Castro Viganego
  "54168483": "SCRUM_HALF", // Lucas Gastón Rubilar
  "54168477": "SCRUM_HALF", // Lucca Marchini Yunis
  "54168480": "PROP", // Sebastian Ramirez Coll
  // Old Macks
  "54158908": "PROP", // Augusto Villanueva Barrera
  "54165743": "FLANKER", // Baltazar Canepa Andrews
  "54158916": "LOCK", // Benjamin Canales Rivas
  "54148197": "FLY_HALF", // Franco Scassi-Buffa Gonzalez
  "54148039": "HOOKER", // Gaspar Moltedo Fonzo
  "54157532": "SCRUM_HALF", // Giorgio Moltedo Fonzo
  "54148199": "LOCK", // Gonzalo Valenzuela Kerestegian
  "54162331": "HOOKER", // Ignacio Berrios
  "54148036": "FLANKER", // Joaquín Ignacio Rivera Meyer
  "54148198": "LOCK", // Joaquín José Troncoso Rubín
  "54148038": "CENTER", // José Ignacio Scheihing Gonzalez
  "54148035": "FLY_HALF", // Juan Rivera Manzor
  "54157536": "SCRUM_HALF", // Julián Troncoso Rubín
  "54162612": "WING", // Luis Sottovia Villanueva
  "54148027": "PROP", // Marco Díaz Alvarado
  "54162335": "FLY_HALF", // Raimundo Maurel Cardemil
  "54148029": "CENTER", // Vicente López
  // Old Reds
  "54164699": "LOCK", // Andrei Cherniavsky Bonacic
  "54164710": "FLY_HALF", // Diego Arturo Espinoza Merino
  "54164714": "FULLBACK", // Enrique Faúndez Saldaño
  "54164736": "FLANKER", // Ignacio Manzanares
  "54164735": "PROP", // Joaquin Manzanares
  "54164757": "SCRUM_HALF", // Jose Miguel Sánchez
  "54164726": "HOOKER", // Juan Harttig
  "54164691": "FULLBACK", // Juan Pablo Coddou Reyes
  "54164745": "CENTER", // Karim Mosa Yousef
  "54164723": "FLANKER", // Lorenzo Gaspar Gutiérrez Saitua
  "54164662": "SCRUM_HALF", // Nicolas Antonucci Sole
  "54164747": "CENTER", // Pablo O'Brien Gallegos
  "54164751": "CENTER", // SANTIAGO PRAT PAPIC
  "54164748": "LOCK", // Santiago Perez Rasmussen
  "54164743": "LOCK", // Thomas Mateluna
  "54164749": "FLY_HALF", // Vicente Pérez Neumann
  "54164756": "FLANKER", // Vicente San Martín Manriquez
  "54164717": "CENTER", // benjamin frias davila
  "54164675": "FULLBACK", // filippo borghi
  // PWCC
  "54167666": "NUMBER_8", // Bruno Vargas
  "54168666": "FLY_HALF", // Carlos Delgado
  "54171093": "FLANKER", // Cristóbal Eduardo Ramírez Lazo
  "54167663": "FLY_HALF", // Damian Fliegel
  "54166754": "CENTER", // Joaquin Milesi
  "54166781": "CENTER", // Juan Cruz Ianchina
  "54168663": "PROP", // Juan Ignacio Piña Naudon
  "54159415": "LOCK", // Lukas Carvallo Rauff
  "54167660": "CENTER", // Matías Piña Naudon
  "54166812": "CENTER", // Rae Arce Correa
  "54159416": "FLANKER", // Sebastian Benard Fernández
  "54159419": "CENTER", // Sebastian Cortes Berrios
  "54169908": "WING", // aquilino alonso landa
  "54166755": "FLY_HALF", // iñaki tuset mercier
  // Sporting RC
  "54168346": "FLANKER", // Agustin Porro Carballo
  "54168372": "CENTER", // Alvaro Latorre Tapia
  "54168348": "FLY_HALF", // Bruno Guajardo Naranjo
  "54168344": "FLY_HALF", // Camilo Esteban Ignacio Cornejo Garrido
  "54168313": "PROP", // Daniel Jackson Georgi
  "54168370": "SCRUM_HALF", // Earving Velarde Brandt
  "54168333": "PROP", // Emanuel Brane Romero
  "54168308": "PROP", // Fernando Meyer Hormaechea
  "54168314": "WING", // Franco Yany Costa
  "54168368": "FLANKER", // Juan Pablo Gómez Miranda
  "54168360": "HOOKER", // Martín Jackson Georgi
  "54168367": "PROP", // Matias Vega García
  "54168299": "FLANKER", // Matías Iker Zavala Hormaechea
  "54168355": "LOCK", // Rodrigo Gajardo pizarro
  "54168332": "HOOKER", // Vicente Reyes piñones
  "54189571": "FLANKER", // bruno adolfo
  "54230413": "SCRUM_HALF", // sebastian ibarra
  // Stade Francais
  "54166064": "PROP", // Christian Duarte Ortega
  "54166025": "FLY_HALF", // Christian Huerta Moraga
  "54161316": "SCRUM_HALF", // Claudio Fernando Iturra Ureta
  "54153963": "LOCK", // Felipe Alberto Flores Puelma
  "54166066": "HOOKER", // Francisco Vera
  "54153958": "FLANKER", // Gabriel Acuña Quinteros
  "54166020": "FLANKER", // Gael León Gómez Pérez
  "54168201": "LOCK", // Germán Herrera Luhrs
  "54153961": "SCRUM_HALF", // Ignacio Flores Vásquez
  "54166060": "SCRUM_HALF", // Ignacio Silva Aninat
  "54154357": "PROP", // Javier Alonso Cifuentes Chilovitis
  "54166021": "HOOKER", // Joaquín Huici Espinosa
  "54154151": "FLY_HALF", // Maximiliano Leiva Angerstein
  "54166102": "CENTER", // Pedro Pablo Ubeda Velez
  "54161062": "HOOKER", // Rodrigo Cabrera fuentes
  "54160983": "SCRUM_HALF", // Tomas Cabello Troncoso
  "54166101": "PROP", // Tomas Canales
  "54161047": "LOCK", // Vicente Torres Bunzli
  "54166067": "FLANKER", // jose tomas aguilar tapia
  // UC
  "54167489": "CENTER", // Agustin Infante Ledezma
  "54167566": "CENTER", // Elías Bruchfeld Gurovich
  "54167622": "NUMBER_8", // Ignacio Perrotta Camus
  "54167606": "PROP", // JUAN PABLO DUHALDE PLAZA
  "54167618": "CENTER", // Jaime Andrés Escobar Radic
  "54169830": "CENTER", // Jorge Delgado Romero
  "54168189": "LOCK", // José Munita Williams
  "54167608": "FLY_HALF", // Juan Pablo Perrotta
  "54167605": "WING", // Juan andres Lladser etienne
  "54168168": "HOOKER", // Matias Gonzalez Alcoholado
  "54167601": "SCRUM_HALF", // Matias ZAPATA LIZAMA
  "54167603": "FULLBACK", // Maximiliano Silva Radnic
  "54167599": "PROP", // Rufino Costa Echeverria
  "54167626": "LOCK", // Santiago José Izurieta Huerta
  "54189912": "CENTER", // Sebastian Parra Hartard
  "54167604": "HOOKER", // Tomas Gonzalez Hojas
  "54167616": "FLY_HALF", // diego perrotta camus
  "54167624": "PROP", // felipe antonio chavez alarcon
  "54167554": "PROP", // gustavo alfonso benko cornjeo
  "54167602": "PROP", // nicolas paredes benavente
  "54168393": "CENTER", // tarek chahuan beckdorf
  // ── INTERMEDIA ──
  // COBS
  "54168103": "LOCK", // Benjamin Díaz Osorio
  "54168107": "FLANKER", // Clemente Ulloa Soto
  "54168124": "FULLBACK", // Clemente Vásquez
  "54168215": "FULLBACK", // Cristobal Besoain
  "54168218": "FLY_HALF", // Cristobal Vidal Trucco
  "54168224": "CENTER", // Diego Martinez
  "54168220": "PROP", // Diego alliende sylleros
  "54168239": "FLANKER", // Francisco Alvariño
  "54168236": "CENTER", // Francisco Augusto Acevedo Villouta
  "54168238": "CENTER", // Francisco Figueroa Viteri
  "54168251": "FLANKER", // Ignacio Bravo Cuchacovich
  "54168275": "HOOKER", // Joao Alves
  "54168126": "PROP", // Juan Pablo Labbe
  "54168116": "CENTER", // Lucas Fyfe Pinto
  "54168115": "FLY_HALF", // Lucas Munoz
  "54168204": "NUMBER_8", // Max Whiting Gutierrez
  "54168203": "WING", // Nicolas Trucco
  "54168207": "WING", // Nicolás Donoso Cuevas
  "54168199": "SCRUM_HALF", // Pedro Radrigan
  "54168178": "HOOKER", // Tomas Fuentes bernal
  "54168170": "CENTER", // Tomas Morgan Dallan
  "54168171": "PROP", // Tomas Rivera
  "54168213": "CENTER", // alejandro gabler toso
  "54168206": "HOOKER", // rodolfo ivan loyola jeria
  // DOBS
  "54162599": "LOCK", // Andrew Yorston Jeretic
  "54165503": "FULLBACK", // Benjamin Sotomayor paredes
  "54162594": "FLANKER", // Borja Cummins Garcia
  "54158512": "CENTER", // Clemente Escudero Urtubia
  "54158502": "CENTER", // Clemente Jerez San Martín
  "54158499": "FLY_HALF", // Clemente Ramirez Valcarce
  "54189714": "FLANKER", // Diego Yáñez Figueroa
  "54158501": "FULLBACK", // Facundo Victoria Barros
  "54162578": "FLY_HALF", // Gonzalo Antonio Aguilera Munizaga
  "54162598": "PROP", // Joaquín Ignacio Texidó Petzold
  "54162577": "WING", // José Miguel Alcerreca del Río
  "54158495": "LOCK", // Manuel Andrés Arellano Ferrer
  "54167724": "PROP", // Martin Alejandro Lagos Nazal
  "54158503": "FULLBACK", // Martin Andres Osorio Perez
  "54158504": "PROP", // Nicolas Manriquez marcos
  "54162609": "HOOKER", // Nicolas Salazar calcagno
  "54165510": "LOCK", // Pablo ignacio Correa Cortés
  "54162587": "PROP", // Pedro Pablo Rothmann Robinson
  "54162595": "HOOKER", // Santiago Ramos
  "54162603": "WING", // Tomas Aparicio
  "54162586": "HOOKER", // Tomas Passalacqua
  "54158509": "NUMBER_8", // Tomas Serrano Roman
  // Old Boys
  "54158793": "LOCK", // Benito Magnasco
  "54144903": "SCRUM_HALF", // Clemente Barrios
  "54158809": "CENTER", // Clemente Romo Schweitzer
  "54159334": "HOOKER", // Cristobal Saieg Zahr
  "54144975": "FULLBACK", // Lorenzo Huete Larrain
  "54145026": "WING", // Lucas Gil Sanchez
  "54145233": "CENTER", // Martin Grunwald Mollenhauer
  "54161135": "PROP", // Martin Valacco Cordova
  "54145234": "CENTER", // Martín Hurtado Cable
  "54161109": "FLY_HALF", // Mateo Gil Sanchez
  "54163664": "CENTER", // Nicolas Juillerat
  "54164672": "PROP", // Patrick Müller East
  "54145248": "WING", // Raimundo Gigoux Brunner
  "54161096": "WING", // Tomás Meiser Lorda
  "54161254": "CENTER", // Vicente Lozano Moore
  "54158813": "WING", // diego verdugo chahud
  "54158826": "FLY_HALF", // javier antonio morillo otero
  "54162026": "WING", // matias alvarado duclos
  "54159009": "WING", // rafael silva
  // Old Johns
  "54168508": "WING", // Agustin Heredia Postel
  "54168494": "SCRUM_HALF", // Claudio Infante Pozas
  "54168510": "WING", // Cristian Arriagada martinez
  "54168511": "WING", // Diego Martínez Zirpel
  "54168471": "FLY_HALF", // ENRICO FERRAZ BARRIOS
  "54168492": "WING", // Emilio Game Jiménez
  "54189889": "HOOKER", // Francisco Xavier Montivero
  "54168491": "HOOKER", // Gabriel Martinez Puentes
  "54168485": "SCRUM_HALF", // Joaquín Villalón Navarro
  "54191187": "FLY_HALF", // Julian Chamorro
  "54168488": "FLY_HALF", // Luciano Nuñez Gonzalez
  "54168487": "FLY_HALF", // Manuel Ortiz salgado
  "54168470": "PROP", // Martin Anibal Bastidas Carrillo
  "54168456": "FULLBACK", // Nicolas Andres Martinez Estay
  "54168478": "LOCK", // Rolando Rodriguez Abdala
  "54168504": "CENTER", // Sebastian Andres Molina Aguayo
  "54168481": "FLY_HALF", // Sebastian Benavente Bianchi
  "54168473": "PROP", // Sebastián Silva Soto
  "54168503": "CENTER", // Tomás Figueroa Matamala
  "54168499": "PROP", // Tomás Rivas Urra
  // Old Macks
  "54158907": "LOCK", // Benjamin Sepulveda Layuno
  "54159825": "NUMBER_8", // Borja Rioseco Orfali
  "54158906": "FLY_HALF", // Cristobal Salgado Thiers
  "54162380": "CENTER", // Dante Massimo Marchesse Correa
  "54148195": "SCRUM_HALF", // Dante Perocarpi Latorre
  "54158903": "CENTER", // Diego Aguila Rodriguez
  "54162334": "NUMBER_8", // Felipe Figueroa Berger
  "54162336": "WING", // Gabriel Sottovia Villanueva
  "54161331": "LOCK", // Gerald Fox Ibarra
  "54158913": "HOOKER", // Ignacio Tomás González Araya
  "54157535": "PROP", // Lucas Valenzuela Kerestegian
  "54148187": "CENTER", // Matias Guzmán
  "54148196": "CENTER", // Nicolas Rosselot Pizarro
  "54148026": "SCRUM_HALF", // Nicolás Boye Valenzuela
  "54157537": "WING", // Raul Silva Barbosa
  "54148193": "CENTER", // Sebastian Mayral De Micheli
  "54158909": "SCRUM_HALF", // Toarii Valantin
  "54148189": "CENTER", // Vicente Gorichon Crestuzzo
  "54158905": "CENTER", // caleb moran
  "54159826": "WING", // renzo vercellino saenz
  "54162378": "FLY_HALF", // santiago Larraín Stock
  // Old Reds
  "54164711": "FULLBACK", // Domingo Estadella Rios
  "54164702": "CENTER", // Felipe Díaz Rettig
  "54164759": "CENTER", // Francisco Urroz
  "54164739": "FLY_HALF", // Gerard Martin Amar
  "54164705": "WING", // Joaquin Alfonso Doepking Abarzua
  "54164769": "CENTER", // José Miguel Marchant Rodriguez
  "54164767": "SCRUM_HALF", // Juan Ignacio Coria Valenzuela
  "54164750": "FLANKER", // Juan Pablo Pizarro johannesen
  "54166562": "FLANKER", // Matias Cardenas
  "54164707": "CENTER", // Matias Escobar niedermayr
  "54164752": "HOOKER", // Matias Sabaj
  "54210762": "PROP", // Matías Flores Opazo
  "54164753": "WING", // Nicolas Sabaj Valderrama
  "54164906": "WING", // Pablo Felipe Salas Preter
  "54164679": "WING", // Renzo Bozzo Molina
  "54164697": "CENTER", // Sebastian Chavez Siebert
  "54164760": "FLY_HALF", // Tomas Vargas Arias
  "54164663": "CENTER", // Tomás Alonso
  "54164742": "LOCK", // Vicente Martinez Huerta
  "54164730": "CENTER", // benjamin lillo
  "54164701": "LOCK", // santiago de la fuente estay
  "54164778": "WING", // tomas infante fantuzzi
  // PWCC
  "54207110": "SCRUM_HALF", // Agustín Morandé
  "54167665": "CENTER", // Ambrosio Rojas Echave
  "54166816": "HOOKER", // Angelo Alvarado Rojas
  "54166814": "LOCK", // Diego Alvarado Rojas
  "54161745": "FLY_HALF", // Domenico Avelli Maira
  "54166789": "CENTER", // Iñigo Fernandez Zegers
  "54166811": "LOCK", // Javier Baeza Espindola
  "54166752": "LOCK", // Jose Pablo Vargas González
  "54166783": "CENTER", // José-Amaro Guerra Jimenez
  "54166773": "HOOKER", // León Marshall
  "54167731": "NUMBER_8", // Manuel González Briones
  "54166767": "FULLBACK", // Martin Reyes Vercellino
  "54161744": "CENTER", // Matias Beale Aravena
  "54161736": "LOCK", // Matias Ramirez villalobos
  "54190699": "PROP", // Max Dauelsberg Noemi
  "54166804": "CENTER", // Oscar Antonio Canseco Muñoz
  "54167667": "WING", // Pedro Pablo Vergara Meckes
  "54166776": "FLANKER", // Polo Jerez herrera
  "54205976": "FLY_HALF", // RENAN SALAS BRICEÑO
  "54161742": "NUMBER_8", // Ricardo Nahim Lahsen Herreros
  "54192854": "WING", // Santiago Calvo de Bonnafos
  "54159417": "PROP", // Sebastian Andres Vera Soulodre
  "54167680": "NUMBER_8", // Stanko Plancic Zuleta
  "54159412": "LOCK", // Thomas Zawels Rojas
  "54168661": "HOOKER", // sven Langer benavides
  // Sporting RC
  "54168343": "CENTER", // Bruno Peirano
  "54168353": "CENTER", // CARLOS BUSCHMAN MANRIQUEZ
  "54168327": "FLY_HALF", // Esteban Magasich García
  "54168340": "FLANKER", // Felipe Alonso Fuentealba Caro
  "54168342": "LOCK", // Francisco Walters
  "54168331": "NUMBER_8", // Joaquín María Raganato Spertino
  "54168329": "HOOKER", // Jose Daniel Aliaga Contreras
  "54206233": "WING", // Jose Henriquez Calfuqueo
  "54168325": "CENTER", // Jose Tomas Marin Diaz
  "54168295": "HOOKER", // Kurt Wande Ortiz
  "54202516": "HOOKER", // Martín Zavala Hormaechea
  "54168297": "WING", // Matias Ignacio Cardemil Guzman
  "54168310": "CENTER", // Matias Ignacio Irribarra Barrientos
  "54168362": "CENTER", // Sebastián Alvarado Musso
  "54168336": "CENTER", // Sebastián Ortúzar Orestes
  "54168309": "FLY_HALF", // Sergio Toro Martinic
  "54168330": "FLY_HALF", // Vicente Laborde Larrondo
  "54168352": "NUMBER_8", // Vicente Pérez Marholz
  // Stade Francais
  "54154378": "NUMBER_8", // Amaro Xavier Duarte Ortega
  "54161014": "CENTER", // Benjamín Urria
  "54154363": "PROP", // Cristóbal Del Campo
  "54154174": "FLY_HALF", // Felipe Rouret Bueno
  "54154010": "PROP", // Francisco Contador ramirez
  "54168155": "WING", // Gapar Alonso Fuentes Cornejo
  "54232647": "NUMBER_8", // Inti Rai Ubeda Velez
  "54154008": "SCRUM_HALF", // Juan Manuel Castro Almenara
  "54161015": "SCRUM_HALF", // Lucas Fuentes
  "54166027": "FLY_HALF", // Martín Forno Larrañaga
  "54167778": "FLY_HALF", // Nicolas Aravena muñoz
  "54166051": "LOCK", // Nicolás Franco Flores Vásquez
  "54153995": "WING", // Rodrigo Vargas
  "54154031": "CENTER", // Santiago Valderrama
  "54154153": "SCRUM_HALF", // Sebastian Gaete Vega
  "54167849": "WING", // Timothy Mugisha
  "54167777": "CENTER", // Tomas Norambuena France
  "54167861": "FLANKER", // Wladimir Alexis Jeria Muñoz
  "54154360": "PROP", // martin madsen monasterio
  "54161049": "SCRUM_HALF", // silvio carrasco
  // UC
  "54167518": "WING", // Andres Bisquertt Hudson
  "54167541": "PROP", // Baltazar Eduardo
  "54232683": "WING", // Bastián González Muñoz
  "54168195": "PROP", // Benjamin Perez Figueroa
  "54168210": "FLY_HALF", // Benjamin Valdes covarrubias
  "54167557": "CENTER", // Bruno Hervia Salinas
  "54167527": "FULLBACK", // Gianfranco De Giorgis
  "54167570": "HOOKER", // Jaime Martin Canales Rojas
  "54167572": "FULLBACK", // José Ignacio Galdames Preece
  "54167653": "PROP", // Nicolás Asenjo Baltra
  "54189939": "SCRUM_HALF", // Nivolas Astorga amunategui
  "54167582": "CENTER", // Rodrigo Rojas Aldunate
  "54167561": "HOOKER", // Simon San martin Gonzalez
  "54167545": "FLANKER", // Tomas Silva
  "54167569": "CENTER", // franco perrotta camus
  "54168160": "CENTER", // ignacio Jose Roman Bulnes
  // ── PRE_INTERMEDIA ──
  // COBS
  "54168244": "FLANKER", // Clemente Jose Vildosola Urrejola
  "54168221": "HOOKER", // Diego Baudrand Geisse
  "54168225": "CENTER", // Diego Ignacio Beltrán Bucarey
  "54168243": "WING", // Dimitri Simonidis Robles
  "54168256": "PROP", // José Tomás Vildósola Urrejola
  "54168257": "FLY_HALF", // Juan Francisco Naranjo Acosta
  "54168114": "FLANKER", // Lucas Conejero
  "54168119": "CENTER", // Manuel Escandon Duarte
  "54204687": "LOCK", // Marcelo Arancibia
  "54201869": "PROP", // Nicolas Toso Aguirre
  "54168202": "CENTER", // Pedro Pichara
  "54168177": "NUMBER_8", // Tomás García Rodríguez
  "54168161": "CENTER", // Vicente Whiting Gutierrez
  "54168190": "FLY_HALF", // santiago cabargas
  // DOBS
  "54162588": "FLY_HALF", // Bruno Passalacqua Dominguez
  "54162597": "WING", // Cristian Sarquis
  "54158510": "PROP", // Cristobal Villena
  "54167708": "FLANKER", // Nicolas Cornejo calaf
  "54165897": "WING", // Nicolas Degollada Zarate
  "54162602": "FULLBACK", // Nicolás Francisco Rojas Martin
  "54162600": "WING", // Raimundo Elgueta Yávar
  "54165509": "FLY_HALF", // Sebastián Avsolomovich
  // Old Boys
  "54189311": "CENTER", // Franco Solari
  "54158817": "CENTER", // GONZALO CASTRO TRUAN
  "54164451": "HOOKER", // Mateo Droppelmann kenrick
  // Old Johns
  "54168462": "CENTER", // Benjamin Andres Lepe Arroyo
  "54168452": "FLY_HALF", // Clemente Barría Trebilcock
  "54168465": "NUMBER_8", // Diego Alvear
  "54168467": "PROP", // Diego Ravanal Herreros
  "54168496": "SCRUM_HALF", // Ignacio Leal Cartes
  "54168474": "CENTER", // Jorge Avilés Puentes
  "54168495": "SCRUM_HALF", // Juan Francisco Moroni
  "54168497": "CENTER", // Mario Romero Grant
  "54170061": "SCRUM_HALF", // Matias Joaquin Miranda Villa
  "54168509": "WING", // Mauricio Ceroni Escribano
  "54168493": "HOOKER", // Teodoro Rojas Vargas
  "54168506": "CENTER", // Tomás Salazar Anriquez
  "54173620": "PROP", // alan bastian valenzuela oportus
  // Old Macks
  "54162379": "CENTER", // Agustín Quiroz Muñoz
  "54148185": "NUMBER_8", // Alonso Gabriel Arriaza Marholz
  "54159827": "FLY_HALF", // Dante Caselli Rivera
  "54159872": "SCRUM_HALF", // Francesco Romeo Hughes
  "54148031": "CENTER", // Francisco Muñoz Balaresque
  "54165744": "CENTER", // Giuseppe Piceor
  "54148188": "WING", // Ignacio Guajardo González
  "54165699": "FLANKER", // Kurt Mc Nab Gschwind
  "54189224": "FLANKER", // Lukas Marinovic Torrealba
  "54201553": "FLANKER", // Matias Valenzuela Wallis
  "54162339": "NUMBER_8", // Miguel Sariego Márquez
  "54158904": "FLANKER", // Nasir Halasa Hales
  "54158914": "CENTER", // Paul Wilkins
  "54158910": "FLY_HALF", // Rafael Zavala
  "54148108": "SCRUM_HALF", // Renato Patricio Salazar Escarate
  "54148191": "LOCK", // Sebastian Jeria Leiva
  "54148032": "FLY_HALF", // Sebastián Novoa Espinosa
  "54188881": "NUMBER_8", // Tomas Perez Martinez
  // Old Reds
  "54164673": "PROP", // Giancarlo Bertonati guidugli
  "54164913": "PROP", // Ignacio Rojas
  "54203047": "CENTER", // Jose Tomas Barrena Botto
  "54203086": "CENTER", // José Joaquín Pérez Santander
  "54164667": "PROP", // Sebastián Henriquez Astudillo
  "54185378": "CENTER", // felipe perez uribe
  "54166566": "FLY_HALF", // jeremias vergara alvarez
  // PWCC
  "54168658": "CENTER", // Alvaro Lapostol López
  "54159418": "WING", // Benjamin Vildósola Middleton
  "54190716": "FLY_HALF", // Clemente Guzman
  "54166785": "WING", // DIEGO ALONSO GOMEZ GONZALEZ
  "54166787": "PROP", // Esteban Sebastián Foncea Figueroa
  "54166758": "WING", // Francisco Soto Arredondo
  "54161748": "PROP", // Moises Aceituno Fernandez
  "54161546": "FLY_HALF", // Máximo Agustín Canales Neciosup
  "54167658": "PROP", // Naguib Chejade villaseca
  "54166801": "FLANKER", // Pablo Cornejo López
  "54166797": "CENTER", // Raimundo Delgado
  "54205970": "FLANKER", // Sebastián Ayala Clarke
  "54186208": "FLY_HALF", // Sebastián Urra Melo
  // Sporting RC
  "54183583": "CENTER", // Aldo Pellerano Aure
  "54228862": "FULLBACK", // Benjamín Lira Lara
  "54168369": "CENTER", // Cristóbal Tobar Fuentes
  "54168365": "HOOKER", // Daniel Ignacio Maturana Huerta
  "54168347": "LOCK", // Diego Pérez Ahumada
  "54168296": "FLANKER", // Diego Silva
  "54168293": "PROP", // Javier Sandoval carrera
  "54168364": "WING", // Lucas Arevalo Cea
  "54168341": "FULLBACK", // Luciano Araya
  "54168307": "LOCK", // Martin Ignacio Gil Barrera
  "54168354": "PROP", // Martín Guerra Barrera
  "54168301": "PROP", // Maxi López
  "54206239": "WING", // Rodrigo Ivan Walters Diaz
  "54168311": "LOCK", // Sebastiam Alejandro Carrasco Mansilla
  "54168320": "LOCK", // Tiécoura Kanouté Passalacqua
  "54230414": "LOCK", // Vicente Nanjari bahamondes
  "54168323": "WING", // matias carrera subiabre
  "54168326": "PROP", // maximiliano miranda
  // Stade Francais
  "54166022": "SCRUM_HALF", // Luis Opazo
  "54154007": "FULLBACK", // Lukas Ruz Ortiz
  "54154155": "LOCK", // Martín Vera Burgos
  "54168109": "FLANKER", // Matías Ignacio Pujol Luco
  "54154128": "CENTER", // Maximiliano Cobre Vergara
  "54154175": "FLY_HALF", // Nicolás Pereira Tapia
  "54168147": "CENTER", // Pedro Sepúlveda Leyton
  "54161032": "CENTER", // Simón Whiting Monreal
  // UC
  "54167498": "FLY_HALF", // Diego Sironvalle Padilla
  "54170103": "SCRUM_HALF", // Felipe Riveros Dolarea
  "54167495": "SCRUM_HALF", // Francisco Rincón Hetz
  "54168537": "WING", // Gabirel Leon Rego
  "54167501": "WING", // Hernan Ruiz Bravo
  "54167493": "CENTER", // Joaquin Baraona Prat
  "54167496": "WING", // Jorge Harambillet
  "54167455": "SCRUM_HALF", // Mauricio Quiros
  "54225593": "PROP", // Máximo Speciali
  "54167459": "CENTER", // Rodrigo Donoso Durante
  "54168145": "CENTER", // agustin leon lara manriquez
};
