// Fantasy player positions — arusaId -> { primary, secondary?, division }.
//
// Every entry is real, aggregated from Instagram nómina XVs across matchdays:
// primary = most-played position, secondary = next, division = where the player
// appears most. No seeded guesses — a player with no lineup has no entry and is
// not in the fantasy pool. Rebuild with
// `npx tsx src/scripts/buildPlayerPositions.ts` (api package).

import type { Division, Position } from "@/lib/fantasy";

export interface PlayerPosition { primary: Position; secondary?: Position; division: Division; }

export const PLAYER_POSITIONS: Record<string, PlayerPosition> = {
  // ── PRIMERA ──
  // COBS
  "54168101": { primary: "CENTER", secondary: "WING", division: "primera" }, // Benjamín Escobedo
  "54168108": { primary: "FULLBACK", secondary: "WING", division: "primera" }, // Benjamin Sandoval
  "54168107": { primary: "PROP", division: "primera" }, // Clemente Ulloa Soto
  "54168222": { primary: "LOCK", division: "primera" }, // Diego Lagos Pimstein
  "54167817": { primary: "FLANKER", division: "primera" }, // Eduardo Antonio Orpis Ramírez
  "54168241": { primary: "PROP", division: "primera" }, // enzo neglia
  "54168249": { primary: "PROP", secondary: "HOOKER", division: "primera" }, // Felipe Andrés Beltrán Bucarey
  "54168132": { primary: "HOOKER", division: "primera" }, // Franco Costantino Roger
  "54189004": { primary: "CENTER", division: "primera" }, // Gonzalo Lara Mehech
  "54168250": { primary: "LOCK", secondary: "FLANKER", division: "primera" }, // Ignacio Soublette
  "54256610": { primary: "FLANKER", division: "primera" }, // Iñaki de Urruticoechea Valenzuela
  "54168252": { primary: "SCRUM_HALF", division: "primera" }, // Jan Hasenlechner
  "54168253": { primary: "PROP", division: "primera" }, // Jorge Araya Morales
  "54168278": { primary: "WING", secondary: "CENTER", division: "primera" }, // José Ignacio Escobedo Leiva
  "54168258": { primary: "LOCK", division: "primera" }, // Juan Pablo Beheran Castro
  "54168122": { primary: "FULLBACK", secondary: "FLY_HALF", division: "primera" }, // Lucas Sandoval Pino
  "54168118": { primary: "FLY_HALF", division: "primera" }, // Martin De Oto Davids
  "54168127": { primary: "CENTER", division: "primera" }, // Martin Escobar
  "54168193": { primary: "WING", division: "primera" }, // Rodrigo Araya
  "54168185": { primary: "FLANKER", division: "primera" }, // SEBASTIAN GONZALEZ REISS
  "54168178": { primary: "WING", division: "primera" }, // Tomas Fuentes bernal
  "54168171": { primary: "HOOKER", secondary: "PROP", division: "primera" }, // Tomas Rivera
  "54168162": { primary: "PROP", division: "primera" }, // Vicente Codorniu
  "54167824": { primary: "NUMBER_8", division: "primera" }, // Vicente Contreras
  // DOBS
  "54158490": { primary: "FLANKER", secondary: "PROP", division: "primera" }, // Andro Kovacic
  "54200315": { primary: "PROP", division: "primera" }, // benjamin moreno millas
  "54200312": { primary: "FLANKER", division: "primera" }, // Clemente Armstrong Rios
  "54158488": { primary: "FLY_HALF", division: "primera" }, // cristobal atenas parra
  "54162583": { primary: "HOOKER", secondary: "PROP", division: "primera" }, // Cristobal Rene Lagos Nazal
  "54158498": { primary: "CENTER", division: "primera" }, // Cristobal serrano roman
  "54158496": { primary: "LOCK", division: "primera" }, // Diego Pinochet Sinsay
  "54158505": { primary: "PROP", division: "primera" }, // Diego Zamora fantuzzi
  "54158489": { primary: "LOCK", division: "primera" }, // Domingo Montan Moreno
  "54158491": { primary: "PROP", division: "primera" }, // Fernando Javier Sahady Molina
  "54158494": { primary: "WING", division: "primera" }, // Franco Rossi Santibañez
  "54162580": { primary: "SCRUM_HALF", division: "primera" }, // German Oelckers Daccarett
  "54158487": { primary: "FLANKER", division: "primera" }, // Gonzalo Cordova Diemer
  "54158506": { primary: "FULLBACK", division: "primera" }, // Ignacio Arias Rivera
  "54162576": { primary: "WING", division: "primera" }, // Ignacio Giacaman Sabal
  "54162589": { primary: "LOCK", division: "primera" }, // joaquin cornejo calaf
  "54162598": { primary: "FLANKER", secondary: "NUMBER_8", division: "primera" }, // Joaquín Ignacio Texidó Petzold
  "54162579": { primary: "HOOKER", secondary: "PROP", division: "primera" }, // joseph uauy zirinsky
  "54158495": { primary: "PROP", secondary: "HOOKER", division: "primera" }, // Manuel Andrés Arellano Ferrer
  "54162585": { primary: "CENTER", division: "primera" }, // Martin Leiva
  "54162582": { primary: "CENTER", division: "primera" }, // Nicolas Alvarez Romo
  "54162601": { primary: "WING", division: "primera" }, // Nicolas Papasideris Barbosa
  "54158486": { primary: "SCRUM_HALF", division: "primera" }, // Pedro Pablo Arias Rivera
  "54158492": { primary: "WING", secondary: "CENTER", division: "primera" }, // Renato Sebastian Arias Rivera
  "54162581": { primary: "FLANKER", division: "primera" }, // Roberto Melo Zolezzi
  "54162584": { primary: "NUMBER_8", secondary: "PROP", division: "primera" }, // Santiago Montan Moreno
  "54158509": { primary: "FLY_HALF", secondary: "SCRUM_HALF", division: "primera" }, // Tomas Serrano Roman
  // Old Boys
  "54144637": { primary: "HOOKER", division: "primera" }, // Antonio Andrés Bozzolo Kullmer
  "54144886": { primary: "SCRUM_HALF", division: "primera" }, // Benjamín Goñi Hartard
  "54144903": { primary: "SCRUM_HALF", division: "primera" }, // Clemente Barrios
  "54158813": { primary: "WING", secondary: "CENTER", division: "primera" }, // diego verdugo chahud
  "54189595": { primary: "WING", division: "primera" }, // Federico Kennedy
  "54144920": { primary: "NUMBER_8", secondary: "FLANKER", division: "primera" }, // Gabriel Ljubetic Carzoglio
  "54144934": { primary: "FLANKER", secondary: "CENTER", division: "primera" }, // Ian Otersen Kanaan
  "54144956": { primary: "HOOKER", division: "primera" }, // Jose Tomas Silva Lobo
  "54164468": { primary: "LOCK", secondary: "PROP", division: "primera" }, // Lucas Haddad Domingo
  "54145235": { primary: "FULLBACK", division: "primera" }, // Mateo Carvajal
  "54158978": { primary: "LOCK", division: "primera" }, // Mauro Saez
  "54161159": { primary: "WING", division: "primera" }, // Maximiliano Robles
  "54161202": { primary: "LOCK", division: "primera" }, // Nicolas Yañez Ureta
  "54259350": { primary: "PROP", division: "primera" }, // pablo huete cibrario
  "54271097": { primary: "CENTER", division: "primera" }, // Pastor Melo
  "54158967": { primary: "CENTER", division: "primera" }, // Santiago Ostornol
  "54145070": { primary: "PROP", division: "primera" }, // Sebastian Valech Alonso
  "54145258": { primary: "FLY_HALF", division: "primera" }, // Tomas Andres Alvarado Duclos
  "54145262": { primary: "NUMBER_8", division: "primera" }, // Vicente Ayarza Saporta
  "54145264": { primary: "FLANKER", division: "primera" }, // Vicente Huete Larrain
  // Old Johns
  "54168453": { primary: "WING", secondary: "FULLBACK", division: "primera" }, // Agustin Alonso Game Jimenez
  "54168458": { primary: "PROP", division: "primera" }, // Aldair Márquez cahuana
  "54168461": { primary: "LOCK", division: "primera" }, // Allen Felipe Ruminot Cabezas
  "54189864": { primary: "NUMBER_8", secondary: "FLANKER", division: "primera" }, // Benjamin Soto Besamat
  "54168455": { primary: "WING", division: "primera" }, // Cristobal Martinez Estay
  "54168464": { primary: "LOCK", division: "primera" }, // Cristobal Nicolas Rivas Urra
  "54168463": { primary: "HOOKER", division: "primera" }, // Daivis Leonel Alejandro Guzman Rodriguez
  "54189865": { primary: "FLY_HALF", division: "primera" }, // Diego Pierart
  "54168475": { primary: "PROP", division: "primera" }, // Fabian Andre Lagos Figueroa
  "54189867": { primary: "CENTER", division: "primera" }, // Felipe Neira Spoerer
  "54168486": { primary: "CENTER", division: "primera" }, // Francisco Rivas Urra
  "54168472": { primary: "PROP", division: "primera" }, // Gonzalo Andrés Reyes Jofré
  "54168479": { primary: "PROP", division: "primera" }, // Gonzalo Sepulveda Manquecura
  "54168469": { primary: "SCRUM_HALF", division: "primera" }, // Hermes Didier Pressta
  "54168457": { primary: "FULLBACK", division: "primera" }, // Joaquín Ignacio Dibán Herrera
  "54168498": { primary: "FLANKER", secondary: "LOCK", division: "primera" }, // Juan Pablo Castro Viganego
  "54168483": { primary: "FLANKER", division: "primera" }, // Lucas Gastón Rubilar
  "54168477": { primary: "LOCK", division: "primera" }, // Lucca Marchini Yunis
  "54168488": { primary: "FLANKER", division: "primera" }, // Luciano Nuñez Gonzalez
  "54168484": { primary: "NUMBER_8", division: "primera" }, // Renzo Marchini Yunis
  "54168480": { primary: "FLANKER", division: "primera" }, // Sebastian Ramirez Coll
  // Old Macks
  "54158908": { primary: "FLANKER", division: "primera" }, // Augusto Villanueva Barrera
  "54158916": { primary: "PROP", division: "primera" }, // Benjamin Canales Rivas
  "54158905": { primary: "CENTER", division: "primera" }, // caleb moran
  "54148197": { primary: "FULLBACK", division: "primera" }, // Franco Scassi-Buffa Gonzalez
  "54157532": { primary: "WING", division: "primera" }, // Giorgio Moltedo Fonzo
  "54148199": { primary: "PROP", division: "primera" }, // Gonzalo Valenzuela Kerestegian
  "54162331": { primary: "NUMBER_8", division: "primera" }, // Ignacio Berrios
  "54148198": { primary: "FLANKER", division: "primera" }, // Joaquín José Troncoso Rubín
  "54148035": { primary: "LOCK", secondary: "PROP", division: "primera" }, // Juan Rivera Manzor
  "54157536": { primary: "CENTER", division: "primera" }, // Julián Troncoso Rubín
  "54162612": { primary: "HOOKER", division: "primera" }, // Luis Sottovia Villanueva
  "54148027": { primary: "PROP", division: "primera" }, // Marco Díaz Alvarado
  "54148194": { primary: "WING", division: "primera" }, // Mauro Mazzino Barbagelata
  "54162335": { primary: "FLY_HALF", division: "primera" }, // Raimundo Maurel Cardemil
  "54157537": { primary: "HOOKER", division: "primera" }, // Raul Silva Barbosa
  "54159826": { primary: "WING", division: "primera" }, // renzo vercellino saenz
  "54148193": { primary: "LOCK", division: "primera" }, // Sebastian Mayral De Micheli
  "54148032": { primary: "SCRUM_HALF", division: "primera" }, // Sebastián Novoa Espinosa
  "54148037": { primary: "FLANKER", division: "primera" }, // Sebastian Rojas Ramirez de Arellano
  "54148189": { primary: "WING", secondary: "CENTER", division: "primera" }, // Vicente Gorichon Crestuzzo
  "54148029": { primary: "WING", division: "primera" }, // Vicente López
  // Old Reds
  "54164699": { primary: "CENTER", division: "primera" }, // Andrei Cherniavsky Bonacic
  "54164717": { primary: "PROP", division: "primera" }, // benjamin frias davila
  "54164710": { primary: "FLY_HALF", secondary: "FULLBACK", division: "primera" }, // Diego Arturo Espinoza Merino
  "54164714": { primary: "PROP", division: "primera" }, // Enrique Faúndez Saldaño
  "54164675": { primary: "LOCK", division: "primera" }, // filippo borghi
  "54204496": { primary: "PROP", division: "primera" }, // Francisco Eduardo Bastias Manquian
  "54164759": { primary: "FLY_HALF", secondary: "FULLBACK", division: "primera" }, // Francisco Urroz
  "54164739": { primary: "FLY_HALF", division: "primera" }, // Gerard Martin Amar
  "54164736": { primary: "WING", division: "primera" }, // Ignacio Manzanares
  "54164735": { primary: "FLANKER", division: "primera" }, // Joaquin Manzanares
  "54164757": { primary: "NUMBER_8", division: "primera" }, // Jose Miguel Sánchez
  "54164715": { primary: "WING", secondary: "CENTER", division: "primera" }, // José Pablo Fernández Thiers
  "54164726": { primary: "SCRUM_HALF", division: "primera" }, // Juan Harttig
  "54164691": { primary: "FLY_HALF", secondary: "FULLBACK", division: "primera" }, // Juan Pablo Coddou Reyes
  "54164745": { primary: "FLANKER", secondary: "NUMBER_8", division: "primera" }, // Karim Mosa Yousef
  "54164723": { primary: "LOCK", secondary: "FLANKER", division: "primera" }, // Lorenzo Gaspar Gutiérrez Saitua
  "54164725": { primary: "HOOKER", division: "primera" }, // Manuel Harttig
  "54166562": { primary: "HOOKER", secondary: "PROP", division: "primera" }, // Matias Cardenas
  "54164662": { primary: "LOCK", division: "primera" }, // Nicolas Antonucci Sole
  "54164747": { primary: "HOOKER", division: "primera" }, // Pablo O'Brien Gallegos
  "54256628": { primary: "PROP", division: "primera" }, // Rafael Barrena Botto
  "54164679": { primary: "HOOKER", division: "primera" }, // Renzo Bozzo Molina
  "54164748": { primary: "SCRUM_HALF", division: "primera" }, // Santiago Perez Rasmussen
  "54164751": { primary: "FULLBACK", secondary: "CENTER", division: "primera" }, // SANTIAGO PRAT PAPIC
  "54164743": { primary: "WING", division: "primera" }, // Thomas Mateluna
  "54164663": { primary: "WING", division: "primera" }, // Tomás Alonso
  "54164761": { primary: "CENTER", division: "primera" }, // Tomás Yáñez
  "54164762": { primary: "WING", division: "primera" }, // tomas zehnder novoa
  "54164721": { primary: "PROP", division: "primera" }, // Vicente Gómez
  "54164749": { primary: "LOCK", division: "primera" }, // Vicente Pérez Neumann
  "54164756": { primary: "FLANKER", secondary: "NUMBER_8", division: "primera" }, // Vicente San Martín Manriquez
  // PWCC
  "54166816": { primary: "PROP", division: "primera" }, // Angelo Alvarado Rojas
  "54169908": { primary: "PROP", division: "primera" }, // aquilino alonso landa
  "54167666": { primary: "FLANKER", division: "primera" }, // Bruno Vargas
  "54168666": { primary: "PROP", division: "primera" }, // Carlos Delgado
  "54171093": { primary: "CENTER", division: "primera" }, // Cristóbal Eduardo Ramírez Lazo
  "54167663": { primary: "CENTER", secondary: "FULLBACK", division: "primera" }, // Damian Fliegel
  "54226792": { primary: "WING", division: "primera" }, // Felipe Brangier Valdivia
  "54166755": { primary: "FULLBACK", secondary: "WING", division: "primera" }, // iñaki tuset mercier
  "54166789": { primary: "FLANKER", division: "primera" }, // Iñigo Fernandez Zegers
  "54161743": { primary: "FLANKER", division: "primera" }, // joaquín eduardo bórquez morales
  "54166754": { primary: "NUMBER_8", division: "primera" }, // Joaquin Milesi
  "54166781": { primary: "CENTER", division: "primera" }, // Juan Cruz Ianchina
  "54168663": { primary: "NUMBER_8", secondary: "FLANKER", division: "primera" }, // Juan Ignacio Piña Naudon
  "54159415": { primary: "FLY_HALF", secondary: "SCRUM_HALF", division: "primera" }, // Lukas Carvallo Rauff
  "54167731": { primary: "FLANKER", secondary: "NUMBER_8", division: "primera" }, // Manuel González Briones
  "54167660": { primary: "SCRUM_HALF", division: "primera" }, // Matías Piña Naudon
  "54166776": { primary: "HOOKER", secondary: "PROP", division: "primera" }, // Polo Jerez herrera
  "54166812": { primary: "WING", division: "primera" }, // Rae Arce Correa
  "54205976": { primary: "FLY_HALF", division: "primera" }, // RENAN SALAS BRICEÑO
  "54159416": { primary: "LOCK", division: "primera" }, // Sebastian Benard Fernández
  "54159419": { primary: "HOOKER", division: "primera" }, // Sebastian Cortes Berrios
  "54166794": { primary: "LOCK", division: "primera" }, // Vicente agustin Fernández canales
  // Sporting RC
  "54168346": { primary: "HOOKER", division: "primera" }, // Agustin Porro Carballo
  "54168372": { primary: "FULLBACK", secondary: "FLY_HALF", division: "primera" }, // Alvaro Latorre Tapia
  "54168333": { primary: "WING", division: "primera" }, // Emanuel Brane Romero
  "54168308": { primary: "FLANKER", division: "primera" }, // Fernando Meyer Hormaechea
  "54168358": { primary: "CENTER", division: "primera" }, // Gaspar sandoval ortega
  "54168368": { primary: "PROP", division: "primera" }, // Juan Pablo Gómez Miranda
  "54168322": { primary: "NUMBER_8", secondary: "FLANKER", division: "primera" }, // Lorenzo Cicarelli
  "54168363": { primary: "LOCK", division: "primera" }, // Lucas Zavala Hormaecea
  "54168360": { primary: "CENTER", division: "primera" }, // Martín Jackson Georgi
  "54202516": { primary: "LOCK", division: "primera" }, // Martín Zavala Hormaechea
  "54168299": { primary: "LOCK", division: "primera" }, // Matías Iker Zavala Hormaechea
  "54168367": { primary: "NUMBER_8", division: "primera" }, // Matias Vega García
  "54168362": { primary: "WING", division: "primera" }, // Sebastián Alvarado Musso
  "54230413": { primary: "PROP", division: "primera" }, // sebastian ibarra
  "54168309": { primary: "FULLBACK", division: "primera" }, // Sergio Toro Martinic
  "54168351": { primary: "FLANKER", division: "primera" }, // TOMAS AYALA PLAZA
  "54168330": { primary: "FLY_HALF", secondary: "SCRUM_HALF", division: "primera" }, // Vicente Laborde Larrondo
  "54168352": { primary: "SCRUM_HALF", secondary: "WING", division: "primera" }, // Vicente Pérez Marholz
  // Stade Francais
  "54166017": { primary: "PROP", division: "primera" }, // Alvaro Tejos
  "54192051": { primary: "FLANKER", division: "primera" }, // Benjamin Soto Madrigal
  "54166064": { primary: "PROP", division: "primera" }, // Christian Duarte Ortega
  "54166025": { primary: "CENTER", division: "primera" }, // Christian Huerta Moraga
  "54161316": { primary: "PROP", division: "primera" }, // Claudio Fernando Iturra Ureta
  "54153963": { primary: "CENTER", division: "primera" }, // Felipe Alberto Flores Puelma
  "54154174": { primary: "FLY_HALF", division: "primera" }, // Felipe Rouret Bueno
  "54166066": { primary: "SCRUM_HALF", division: "primera" }, // Francisco Vera
  "54153958": { primary: "HOOKER", division: "primera" }, // Gabriel Acuña Quinteros
  "54166020": { primary: "LOCK", division: "primera" }, // Gael León Gómez Pérez
  "54168201": { primary: "FULLBACK", division: "primera" }, // Germán Herrera Luhrs
  "54153961": { primary: "PROP", division: "primera" }, // Ignacio Flores Vásquez
  "54166060": { primary: "FLANKER", division: "primera" }, // Ignacio Silva Aninat
  "54232647": { primary: "NUMBER_8", division: "primera" }, // Inti Rai Ubeda Velez
  "54154357": { primary: "PROP", secondary: "HOOKER", division: "primera" }, // Javier Alonso Cifuentes Chilovitis
  "54166021": { primary: "FLY_HALF", secondary: "CENTER", division: "primera" }, // Joaquín Huici Espinosa
  "54232649": { primary: "PROP", division: "primera" }, // Juan Ignacio Letelier fuentes
  "54154151": { primary: "NUMBER_8", secondary: "FLANKER", division: "primera" }, // Maximiliano Leiva Angerstein
  "54166102": { primary: "WING", division: "primera" }, // Pedro Pablo Ubeda Velez
  "54168147": { primary: "WING", division: "primera" }, // Pedro Sepúlveda Leyton
  "54161062": { primary: "LOCK", division: "primera" }, // Rodrigo Cabrera fuentes
  "54166103": { primary: "PROP", division: "primera" }, // Samuel Cerón Parra
  "54160983": { primary: "WING", division: "primera" }, // Tomas Cabello Troncoso
  "54167777": { primary: "WING", division: "primera" }, // Tomas Norambuena France
  // UC
  "54167489": { primary: "FULLBACK", division: "primera" }, // Agustin Infante Ledezma
  "54167518": { primary: "PROP", division: "primera" }, // Andres Bisquertt Hudson
  "54232683": { primary: "HOOKER", division: "primera" }, // Bastián González Muñoz
  "54168195": { primary: "WING", division: "primera" }, // Benjamin Perez Figueroa
  "54167616": { primary: "FLY_HALF", division: "primera" }, // diego perrotta camus
  "54167566": { primary: "WING", division: "primera" }, // Elías Bruchfeld Gurovich
  "54167624": { primary: "CENTER", division: "primera" }, // felipe antonio chavez alarcon
  "54167554": { primary: "CENTER", division: "primera" }, // gustavo alfonso benko cornjeo
  "54167622": { primary: "WING", secondary: "CENTER", division: "primera" }, // Ignacio Perrotta Camus
  "54167618": { primary: "WING", division: "primera" }, // Jaime Andrés Escobar Radic
  "54168189": { primary: "PROP", division: "primera" }, // José Munita Williams
  "54167605": { primary: "FLANKER", division: "primera" }, // Juan andres Lladser etienne
  "54167606": { primary: "NUMBER_8", division: "primera" }, // JUAN PABLO DUHALDE PLAZA
  "54167608": { primary: "SCRUM_HALF", division: "primera" }, // Juan Pablo Perrotta
  "54168168": { primary: "CENTER", division: "primera" }, // Matias Gonzalez Alcoholado
  "54167601": { primary: "PROP", division: "primera" }, // Matias ZAPATA LIZAMA
  "54167603": { primary: "LOCK", division: "primera" }, // Maximiliano Silva Radnic
  "54167602": { primary: "LOCK", division: "primera" }, // nicolas paredes benavente
  "54167599": { primary: "PROP", division: "primera" }, // Rufino Costa Echeverria
  "54189912": { primary: "HOOKER", division: "primera" }, // Sebastian Parra Hartard
  "54167604": { primary: "FLANKER", secondary: "LOCK", division: "primera" }, // Tomas Gonzalez Hojas
  "54167545": { primary: "FLANKER", division: "primera" }, // Tomas Silva
  // ── INTERMEDIA ──
  // COBS
  "54168213": { primary: "PROP", division: "intermedia" }, // alejandro gabler toso
  "54168091": { primary: "HOOKER", secondary: "NUMBER_8", division: "intermedia" }, // Andrés Vial Aldridge
  "54168124": { primary: "LOCK", division: "intermedia" }, // Clemente Vásquez
  "54168215": { primary: "FULLBACK", secondary: "PROP", division: "intermedia" }, // Cristobal Besoain
  "54168218": { primary: "LOCK", division: "intermedia" }, // Cristobal Vidal Trucco
  "54168220": { primary: "FLANKER", division: "intermedia" }, // Diego alliende sylleros
  "54168224": { primary: "PROP", division: "intermedia" }, // Diego Martinez
  "54190103": { primary: "WING", division: "intermedia" }, // Fernando López Rossi
  "54168236": { primary: "PROP", division: "intermedia" }, // Francisco Augusto Acevedo Villouta
  "54168238": { primary: "FLY_HALF", division: "intermedia" }, // Francisco Figueroa Viteri
  "54168251": { primary: "HOOKER", division: "intermedia" }, // Ignacio Bravo Cuchacovich
  "54168126": { primary: "SCRUM_HALF", division: "intermedia" }, // Juan Pablo Labbe
  "54201867": { primary: "PROP", secondary: "HOOKER", division: "intermedia" }, // JULIAN MANZUR
  "54168115": { primary: "CENTER", division: "intermedia" }, // Lucas Munoz
  "54168204": { primary: "FLANKER", division: "intermedia" }, // Max Whiting Gutierrez
  "54168207": { primary: "CENTER", division: "intermedia" }, // Nicolás Donoso Cuevas
  "54168202": { primary: "WING", division: "intermedia" }, // Pedro Pichara
  "54168199": { primary: "LOCK", secondary: "FLANKER", division: "intermedia" }, // Pedro Radrigan
  "54168206": { primary: "FULLBACK", secondary: "WING", division: "intermedia" }, // rodolfo ivan loyola jeria
  "54230369": { primary: "NUMBER_8", secondary: "FLANKER", division: "intermedia" }, // Tomás Fyfe Pinto
  "54168170": { primary: "WING", division: "intermedia" }, // Tomas Morgan Dallan
  // DOBS
  "54162599": { primary: "FULLBACK", secondary: "WING", division: "intermedia" }, // Andrew Yorston Jeretic
  "54165503": { primary: "LOCK", division: "intermedia" }, // Benjamin Sotomayor paredes
  "54162594": { primary: "SCRUM_HALF", division: "intermedia" }, // Borja Cummins Garcia
  "54162588": { primary: "CENTER", secondary: "FULLBACK", division: "intermedia" }, // Bruno Passalacqua Dominguez
  "54238635": { primary: "NUMBER_8", division: "intermedia" }, // Christian Gatica
  "54158512": { primary: "CENTER", division: "intermedia" }, // Clemente Escudero Urtubia
  "54158499": { primary: "FULLBACK", secondary: "FLY_HALF", division: "intermedia" }, // Clemente Ramirez Valcarce
  "54189714": { primary: "PROP", division: "intermedia" }, // Diego Yáñez Figueroa
  "54158501": { primary: "LOCK", division: "intermedia" }, // Facundo Victoria Barros
  "54162578": { primary: "HOOKER", division: "intermedia" }, // Gonzalo Antonio Aguilera Munizaga
  "54165504": { primary: "WING", division: "intermedia" }, // Ignacio Mena Ehrenfeld
  "54162604": { primary: "LOCK", division: "intermedia" }, // Jordi Sancho
  "54162577": { primary: "WING", division: "intermedia" }, // José Miguel Alcerreca del Río
  "54167724": { primary: "FLY_HALF", division: "intermedia" }, // Martin Alejandro Lagos Nazal
  "54158503": { primary: "NUMBER_8", secondary: "FLANKER", division: "intermedia" }, // Martin Andres Osorio Perez
  "54165897": { primary: "WING", secondary: "CENTER", division: "intermedia" }, // Nicolas Degollada Zarate
  "54162602": { primary: "HOOKER", division: "intermedia" }, // Nicolás Francisco Rojas Martin
  "54158504": { primary: "FLANKER", division: "intermedia" }, // Nicolas Manriquez marcos
  "54162609": { primary: "WING", division: "intermedia" }, // Nicolas Salazar calcagno
  "54165510": { primary: "PROP", division: "intermedia" }, // Pablo ignacio Correa Cortés
  "54162587": { primary: "HOOKER", secondary: "PROP", division: "intermedia" }, // Pedro Pablo Rothmann Robinson
  "54162595": { primary: "LOCK", division: "intermedia" }, // Santiago Ramos
  "54162610": { primary: "PROP", division: "intermedia" }, // Sebastián Berner Carrasco
  "54158511": { primary: "PROP", division: "intermedia" }, // Sebastián Ghawali Pérez
  "54162603": { primary: "FLANKER", division: "intermedia" }, // Tomas Aparicio
  "54162586": { primary: "CENTER", division: "intermedia" }, // Tomas Passalacqua
  "54158493": { primary: "PROP", secondary: "HOOKER", division: "intermedia" }, // Vicente Alcaino Sepulveda
  // Old Boys
  "54158809": { primary: "FULLBACK", division: "intermedia" }, // Clemente Romo Schweitzer
  "54158823": { primary: "CENTER", division: "intermedia" }, // Jaime Ignacio Soler Muñoz
  "54144971": { primary: "WING", division: "intermedia" }, // Leonardo Valdes Gajardo
  "54144975": { primary: "FLANKER", division: "intermedia" }, // Lorenzo Huete Larrain
  "54145026": { primary: "FLANKER", division: "intermedia" }, // Lucas Gil Sanchez
  "54145233": { primary: "PROP", division: "intermedia" }, // Martin Grunwald Mollenhauer
  "54145234": { primary: "LOCK", division: "intermedia" }, // Martín Hurtado Cable
  "54164424": { primary: "HOOKER", division: "intermedia" }, // Maximiliano Campos Astorquiza
  "54159009": { primary: "HOOKER", division: "intermedia" }, // rafael silva
  "54145248": { primary: "FLY_HALF", division: "intermedia" }, // Raimundo Gigoux Brunner
  "54167815": { primary: "SCRUM_HALF", division: "intermedia" }, // Santiago Wood Urenda
  "54145250": { primary: "LOCK", division: "intermedia" }, // Sebastián Saieh Aravena
  "54145254": { primary: "NUMBER_8", division: "intermedia" }, // thomas cooper mehech
  "54161096": { primary: "WING", division: "intermedia" }, // Tomás Meiser Lorda
  "54161254": { primary: "PROP", division: "intermedia" }, // Vicente Lozano Moore
  // Old Johns
  "54168508": { primary: "FULLBACK", division: "intermedia" }, // Agustin Heredia Postel
  "54168468": { primary: "PROP", division: "intermedia" }, // Bruno Cáceres Catalán
  "54168494": { primary: "LOCK", division: "intermedia" }, // Claudio Infante Pozas
  "54168452": { primary: "FLY_HALF", division: "intermedia" }, // Clemente Barría Trebilcock
  "54168510": { primary: "CENTER", division: "intermedia" }, // Cristian Arriagada martinez
  "54168511": { primary: "WING", division: "intermedia" }, // Diego Martínez Zirpel
  "54168492": { primary: "WING", division: "intermedia" }, // Emilio Game Jiménez
  "54259634": { primary: "FLANKER", division: "intermedia" }, // Francisco Martinez Zirpel
  "54189889": { primary: "LOCK", secondary: "FLANKER", division: "intermedia" }, // Francisco Xavier Montivero
  "54168491": { primary: "CENTER", division: "intermedia" }, // Gabriel Martinez Puentes
  "54168513": { primary: "WING", division: "intermedia" }, // Joaquín Enríquez
  "54168485": { primary: "SCRUM_HALF", division: "intermedia" }, // Joaquín Villalón Navarro
  "54191187": { primary: "HOOKER", division: "intermedia" }, // Julian Chamorro
  "54168487": { primary: "PROP", secondary: "HOOKER", division: "intermedia" }, // Manuel Ortiz salgado
  "54168470": { primary: "HOOKER", division: "intermedia" }, // Martin Anibal Bastidas Carrillo
  "54168456": { primary: "FULLBACK", division: "intermedia" }, // Nicolas Andres Martinez Estay
  "54168478": { primary: "PROP", division: "intermedia" }, // Rolando Rodriguez Abdala
  "54168504": { primary: "NUMBER_8", division: "intermedia" }, // Sebastian Andres Molina Aguayo
  "54168481": { primary: "FLY_HALF", division: "intermedia" }, // Sebastian Benavente Bianchi
  "54168473": { primary: "FLANKER", division: "intermedia" }, // Sebastián Silva Soto
  "54168503": { primary: "CENTER", division: "intermedia" }, // Tomás Figueroa Matamala
  "54168499": { primary: "LOCK", division: "intermedia" }, // Tomás Rivas Urra
  // Old Macks
  "54229651": { primary: "LOCK", division: "intermedia" }, // Carlo Schiappacasse Pérez
  "54158906": { primary: "FLY_HALF", division: "intermedia" }, // Cristobal Salgado Thiers
  "54158903": { primary: "PROP", division: "intermedia" }, // Diego Aguila Rodriguez
  "54148031": { primary: "SCRUM_HALF", division: "intermedia" }, // Francisco Muñoz Balaresque
  "54189000": { primary: "CENTER", division: "intermedia" }, // Franco Airola Diaz de Cerio
  "54229650": { primary: "PROP", division: "intermedia" }, // Gabriel Fonzo Arias
  "54162336": { primary: "FLANKER", division: "intermedia" }, // Gabriel Sottovia Villanueva
  "54148188": { primary: "HOOKER", secondary: "PROP", division: "intermedia" }, // Ignacio Guajardo González
  "54189224": { primary: "WING", division: "intermedia" }, // Lukas Marinovic Torrealba
  "54148028": { primary: "FLANKER", division: "intermedia" }, // Nicolas Diaz Pozo
  "54158910": { primary: "FULLBACK", division: "intermedia" }, // Rafael Zavala
  "54162378": { primary: "WING", division: "intermedia" }, // santiago Larraín Stock
  "54188881": { primary: "CENTER", division: "intermedia" }, // Tomas Perez Martinez
  // Old Reds
  "54166512": { primary: "PROP", division: "intermedia" }, // Diego Sereño
  "54164702": { primary: "LOCK", division: "intermedia" }, // Felipe Díaz Rettig
  "54164705": { primary: "PROP", secondary: "LOCK", division: "intermedia" }, // Joaquin Alfonso Doepking Abarzua
  "54164769": { primary: "FULLBACK", secondary: "CENTER", division: "intermedia" }, // José Miguel Marchant Rodriguez
  "54203047": { primary: "CENTER", division: "intermedia" }, // Jose Tomas Barrena Botto
  "54164767": { primary: "WING", division: "intermedia" }, // Juan Ignacio Coria Valenzuela
  "54164750": { primary: "CENTER", division: "intermedia" }, // Juan Pablo Pizarro johannesen
  "54164707": { primary: "SCRUM_HALF", division: "intermedia" }, // Matias Escobar niedermayr
  "54210762": { primary: "PROP", division: "intermedia" }, // Matías Flores Opazo
  "54231572": { primary: "NUMBER_8", division: "intermedia" }, // Samuel Astorga López
  "54164701": { primary: "FLANKER", division: "intermedia" }, // santiago de la fuente estay
  "54164697": { primary: "PROP", secondary: "HOOKER", division: "intermedia" }, // Sebastian Chavez Siebert
  "54164719": { primary: "FLANKER", division: "intermedia" }, // Thomas Fourt Uribe
  "54164709": { primary: "FLY_HALF", division: "intermedia" }, // Tomás Espinoza Espinoza
  "54164778": { primary: "WING", division: "intermedia" }, // tomas infante fantuzzi
  "54164742": { primary: "WING", division: "intermedia" }, // Vicente Martinez Huerta
  // PWCC
  "54207110": { primary: "CENTER", division: "intermedia" }, // Agustín Morandé
  "54161739": { primary: "PROP", secondary: "HOOKER", division: "intermedia" }, // Bruno Lira Montero
  "54190716": { primary: "WING", secondary: "CENTER", division: "intermedia" }, // Clemente Guzman
  "54166814": { primary: "LOCK", division: "intermedia" }, // Diego Alvarado Rojas
  "54161745": { primary: "FLY_HALF", division: "intermedia" }, // Domenico Avelli Maira
  "54166787": { primary: "CENTER", division: "intermedia" }, // Esteban Sebastián Foncea Figueroa
  "54166758": { primary: "FLANKER", division: "intermedia" }, // Francisco Soto Arredondo
  "54166811": { primary: "LOCK", division: "intermedia" }, // Javier Baeza Espindola
  "54166752": { primary: "HOOKER", division: "intermedia" }, // Jose Pablo Vargas González
  "54166773": { primary: "FLANKER", division: "intermedia" }, // León Marshall
  "54257082": { primary: "PROP", division: "intermedia" }, // Marco Alexander Vitoria López
  "54166767": { primary: "FULLBACK", division: "intermedia" }, // Martin Reyes Vercellino
  "54161744": { primary: "SCRUM_HALF", division: "intermedia" }, // Matias Beale Aravena
  "54190699": { primary: "NUMBER_8", division: "intermedia" }, // Max Dauelsberg Noemi
  "54161742": { primary: "WING", division: "intermedia" }, // Ricardo Nahim Lahsen Herreros
  "54192854": { primary: "WING", division: "intermedia" }, // Santiago Calvo de Bonnafos
  "54192855": { primary: "PROP", division: "intermedia" }, // Sebastián Ignacio Guarda Contardo
  "54168661": { primary: "CENTER", division: "intermedia" }, // sven Langer benavides
  "54267959": { primary: "LOCK", division: "intermedia" }, // Tomás Martinez
  // Sporting RC
  "54168300": { primary: "FULLBACK", division: "intermedia" }, // Alessandro Gianmarco Cook Ramirez
  "54168318": { primary: "FLANKER", division: "intermedia" }, // BALTAZAR GABRIEL GONZALEZ MONTERO
  "54228862": { primary: "CENTER", division: "intermedia" }, // Benjamín Lira Lara
  "54168369": { primary: "PROP", division: "intermedia" }, // Cristóbal Tobar Fuentes
  "54168365": { primary: "FLANKER", division: "intermedia" }, // Daniel Ignacio Maturana Huerta
  "54168347": { primary: "PROP", secondary: "HOOKER", division: "intermedia" }, // Diego Pérez Ahumada
  "54168327": { primary: "FLY_HALF", division: "intermedia" }, // Esteban Magasich García
  "54168340": { primary: "NUMBER_8", division: "intermedia" }, // Felipe Alonso Fuentealba Caro
  "54168306": { primary: "LOCK", division: "intermedia" }, // Felipe Carcamo Aguilar
  "54168307": { primary: "SCRUM_HALF", division: "intermedia" }, // Martin Ignacio Gil Barrera
  "54168326": { primary: "WING", division: "intermedia" }, // maximiliano miranda
  "54206239": { primary: "LOCK", division: "intermedia" }, // Rodrigo Ivan Walters Diaz
  "54230414": { primary: "HOOKER", secondary: "PROP", division: "intermedia" }, // Vicente Nanjari bahamondes
  "54168332": { primary: "HOOKER", division: "intermedia" }, // Vicente Reyes piñones
  // UC
  "54239256": { primary: "NUMBER_8", division: "intermedia" }, // Dani Gutiérrez Caniulen
  "54167569": { primary: "FULLBACK", division: "intermedia" }, // franco perrotta camus
  "54168537": { primary: "SCRUM_HALF", division: "intermedia" }, // Gabirel Leon Rego
  "54259620": { primary: "PROP", division: "intermedia" }, // Ignacio Andres Fuentealba hidalgo
  "54167570": { primary: "CENTER", division: "intermedia" }, // Jaime Martin Canales Rojas
  "54167639": { primary: "PROP", division: "intermedia" }, // Joaquin Nilo Montecinos
  "54167653": { primary: "CENTER", division: "intermedia" }, // Nicolás Asenjo Baltra
  "54167582": { primary: "WING", division: "intermedia" }, // Rodrigo Rojas Aldunate
  "54231614": { primary: "WING", division: "intermedia" }, // Santiago Rojas Aldunate
  "54239301": { primary: "LOCK", division: "intermedia" }, // Simón Moyano Carreño
  "54167561": { primary: "FLY_HALF", division: "intermedia" }, // Simon San martin Gonzalez
  "54168393": { primary: "FLANKER", division: "intermedia" }, // tarek chahuan beckdorf
  // ── PRE-INTERMEDIA ──
  // COBS
  "54168244": { primary: "PROP", division: "pre-intermedia" }, // Clemente Jose Vildosola Urrejola
  "54168216": { primary: "FLY_HALF", division: "pre-intermedia" }, // Cristobal Gonzalez De Ferari
  "54168221": { primary: "LOCK", secondary: "FLANKER", division: "pre-intermedia" }, // Diego Baudrand Geisse
  "54168225": { primary: "CENTER", secondary: "WING", division: "pre-intermedia" }, // Diego Ignacio Beltrán Bucarey
  "54230364": { primary: "CENTER", secondary: "WING", division: "pre-intermedia" }, // Joaquin Fuentes Barreda
  "54168257": { primary: "FLY_HALF", division: "pre-intermedia" }, // Juan Francisco Naranjo Acosta
  "54168114": { primary: "PROP", secondary: "LOCK", division: "pre-intermedia" }, // Lucas Conejero
  "54228087": { primary: "FLANKER", division: "pre-intermedia" }, // Lucas Radrigan Silva
  "54168119": { primary: "NUMBER_8", secondary: "PROP", division: "pre-intermedia" }, // Manuel Escandon Duarte
  "54204687": { primary: "PROP", division: "pre-intermedia" }, // Marcelo Arancibia
  "54201869": { primary: "SCRUM_HALF", secondary: "CENTER", division: "pre-intermedia" }, // Nicolas Toso Aguirre
  "54168203": { primary: "NUMBER_8", secondary: "SCRUM_HALF", division: "pre-intermedia" }, // Nicolas Trucco
  "54168190": { primary: "FULLBACK", division: "pre-intermedia" }, // santiago cabargas
  "54168188": { primary: "HOOKER", secondary: "PROP", division: "pre-intermedia" }, // Santiago Holmgren
  "54168177": { primary: "PROP", division: "pre-intermedia" }, // Tomás García Rodríguez
  "54168161": { primary: "WING", secondary: "CENTER", division: "pre-intermedia" }, // Vicente Whiting Gutierrez
  // DOBS
  "54238630": { primary: "FLY_HALF", division: "pre-intermedia" }, // Clemente Aguirre Harambillet
  "54158502": { primary: "FLANKER", division: "pre-intermedia" }, // Clemente Jerez San Martín
  "54162597": { primary: "LOCK", secondary: "NUMBER_8", division: "pre-intermedia" }, // Cristian Sarquis
  "54158510": { primary: "FLANKER", division: "pre-intermedia" }, // Cristobal Villena
  "54205916": { primary: "CENTER", secondary: "WING", division: "pre-intermedia" }, // Lucas Lightfoot
  "54238639": { primary: "HOOKER", secondary: "PROP", division: "pre-intermedia" }, // Martin Sahady
  "54230319": { primary: "LOCK", division: "pre-intermedia" }, // Nicholas Holmes Chaud
  "54167708": { primary: "CENTER", division: "pre-intermedia" }, // Nicolas Cornejo calaf
  "54165506": { primary: "PROP", division: "pre-intermedia" }, // Raimundo Andrés Bobillier Ruff
  "54165898": { primary: "PROP", secondary: "HOOKER", division: "pre-intermedia" }, // Renato Fuenzalida Virot
  "54165509": { primary: "LOCK", division: "pre-intermedia" }, // Sebastián Avsolomovich
  "54167709": { primary: "FLANKER", secondary: "PROP", division: "pre-intermedia" }, // Sebastian Medina Middleton
  "54228823": { primary: "WING", division: "pre-intermedia" }, // vicente martinez fernandez
  // Old Boys
  "54158793": { primary: "WING", division: "pre-intermedia" }, // Benito Magnasco
  "54206110": { primary: "CENTER", division: "pre-intermedia" }, // David Scott Benavente
  "54189311": { primary: "FLANKER", division: "pre-intermedia" }, // Franco Solari
  "54158817": { primary: "LOCK", division: "pre-intermedia" }, // GONZALO CASTRO TRUAN
  "54256995": { primary: "PROP", division: "pre-intermedia" }, // JOAQUIN MOYANO VARGAS
  "54144953": { primary: "CENTER", division: "pre-intermedia" }, // John Scott
  "54145231": { primary: "HOOKER", division: "pre-intermedia" }, // Martín Caputo Sanhueza
  "54161109": { primary: "LOCK", division: "pre-intermedia" }, // Mateo Gil Sanchez
  "54145260": { primary: "FLANKER", division: "pre-intermedia" }, // Tomas Hayes Gidi
  // Old Johns
  "54259633": { primary: "LOCK", division: "pre-intermedia" }, // Alfredo Piwonka Caballero
  "54168460": { primary: "PROP", division: "pre-intermedia" }, // Antonio Espinoza
  "54168465": { primary: "CENTER", division: "pre-intermedia" }, // Diego Alvear
  "54168467": { primary: "FLANKER", division: "pre-intermedia" }, // Diego Ravanal Herreros
  "54259524": { primary: "FLY_HALF", division: "pre-intermedia" }, // Diego Villegas Evans
  "54168466": { primary: "LOCK", division: "pre-intermedia" }, // Diether Neudorfer Coronado
  "54168507": { primary: "LOCK", division: "pre-intermedia" }, // gabriel espinoza muñoz
  "54168501": { primary: "FLANKER", secondary: "WING", division: "pre-intermedia" }, // Hernan Venegas torres
  "54168496": { primary: "SCRUM_HALF", division: "pre-intermedia" }, // Ignacio Leal Cartes
  "54168474": { primary: "WING", secondary: "FULLBACK", division: "pre-intermedia" }, // Jorge Avilés Puentes
  "54168495": { primary: "CENTER", division: "pre-intermedia" }, // Juan Francisco Moroni
  "54239613": { primary: "FULLBACK", division: "pre-intermedia" }, // Lucas León Quezada
  "54170061": { primary: "HOOKER", secondary: "PROP", division: "pre-intermedia" }, // Matias Joaquin Miranda Villa
  "54168509": { primary: "PROP", division: "pre-intermedia" }, // Mauricio Ceroni Escribano
  "54168476": { primary: "PROP", division: "pre-intermedia" }, // Maximo Cajales erices
  "54168493": { primary: "WING", secondary: "PROP", division: "pre-intermedia" }, // Teodoro Rojas Vargas
  "54168506": { primary: "LOCK", division: "pre-intermedia" }, // Tomás Salazar Anriquez
  // Old Macks
  "54162379": { primary: "PROP", division: "pre-intermedia" }, // Agustín Quiroz Muñoz
  "54148185": { primary: "FLY_HALF", division: "pre-intermedia" }, // Alonso Gabriel Arriaza Marholz
  "54158911": { primary: "WING", division: "pre-intermedia" }, // Benjamin Reitze Simian
  "54159827": { primary: "FULLBACK", division: "pre-intermedia" }, // Dante Caselli Rivera
  "54148025": { primary: "PROP", division: "pre-intermedia" }, // Eduardo Amestica Carvallo
  "54148186": { primary: "CENTER", division: "pre-intermedia" }, // Giancarlo Dasati Correa
  "54189002": { primary: "WING", division: "pre-intermedia" }, // Gianni franchesco Aceto sacco
  "54162339": { primary: "NUMBER_8", division: "pre-intermedia" }, // Miguel Sariego Márquez
  "54158904": { primary: "FLANKER", division: "pre-intermedia" }, // Nasir Halasa Hales
  "54148026": { primary: "SCRUM_HALF", division: "pre-intermedia" }, // Nicolás Boye Valenzuela
  "54162337": { primary: "LOCK", division: "pre-intermedia" }, // Pascual Ramos
  "54148108": { primary: "HOOKER", secondary: "PROP", division: "pre-intermedia" }, // Renato Patricio Salazar Escarate
  "54148191": { primary: "FLANKER", division: "pre-intermedia" }, // Sebastian Jeria Leiva
  "54148030": { primary: "CENTER", division: "pre-intermedia" }, // vicente Klapp Yanez
  // Old Reds
  "54164779": { primary: "WING", division: "pre-intermedia" }, // Benjamin Becerra
  "54164666": { primary: "HOOKER", division: "pre-intermedia" }, // Diego Astudillo Avendaño
  "54204581": { primary: "WING", division: "pre-intermedia" }, // Eduardo Santander Rodriguez
  "54167846": { primary: "PROP", division: "pre-intermedia" }, // eric gutierrez
  "54185378": { primary: "LOCK", division: "pre-intermedia" }, // felipe perez uribe
  "54164915": { primary: "PROP", division: "pre-intermedia" }, // Javier Cortés Guillaume
  "54166566": { primary: "FULLBACK", division: "pre-intermedia" }, // jeremias vergara alvarez
  "54230409": { primary: "FLY_HALF", division: "pre-intermedia" }, // Jose Manuel Henriquez Gana
  "54269873": { primary: "SCRUM_HALF", secondary: "LOCK", division: "pre-intermedia" }, // José Pablo Pérez Santander
  "54164766": { primary: "HOOKER", division: "pre-intermedia" }, // JUAN PABLO ALVEAR SALINAS
  "54164752": { primary: "CENTER", division: "pre-intermedia" }, // Matias Sabaj
  "54256627": { primary: "PROP", division: "pre-intermedia" }, // matias valenzuela miranda
  "54164906": { primary: "LOCK", division: "pre-intermedia" }, // Pablo Felipe Salas Preter
  "54164683": { primary: "CENTER", division: "pre-intermedia" }, // Sebastian Burgos
  "54164667": { primary: "FLANKER", division: "pre-intermedia" }, // Sebastián Henriquez Astudillo
  // PWCC
  "54190717": { primary: "SCRUM_HALF", division: "pre-intermedia" }, // alvaro fernandez
  "54168658": { primary: "FLANKER", division: "pre-intermedia" }, // Alvaro Lapostol López
  "54167665": { primary: "WING", division: "pre-intermedia" }, // Ambrosio Rojas Echave
  "54159414": { primary: "WING", division: "pre-intermedia" }, // Ignacio Graver González
  "54166783": { primary: "PROP", division: "pre-intermedia" }, // José-Amaro Guerra Jimenez
  "54202135": { primary: "HOOKER", division: "pre-intermedia" }, // Lukas Ronfeldt Carreño
  "54190708": { primary: "WING", division: "pre-intermedia" }, // Maximiliano Preuss Ricci
  "54161546": { primary: "FLY_HALF", division: "pre-intermedia" }, // Máximo Agustín Canales Neciosup
  "54161748": { primary: "LOCK", division: "pre-intermedia" }, // Moises Aceituno Fernandez
  "54166801": { primary: "SCRUM_HALF", division: "pre-intermedia" }, // Pablo Cornejo López
  "54166797": { primary: "NUMBER_8", division: "pre-intermedia" }, // Raimundo Delgado
  "54159417": { primary: "PROP", division: "pre-intermedia" }, // Sebastian Andres Vera Soulodre
  "54205970": { primary: "FULLBACK", division: "pre-intermedia" }, // Sebastián Ayala Clarke
  "54186208": { primary: "WING", division: "pre-intermedia" }, // Sebastián Urra Melo
  "54190725": { primary: "LOCK", division: "pre-intermedia" }, // Tomas Ianchina
  // Sporting RC
  "54168328": { primary: "LOCK", division: "pre-intermedia" }, // Felipe Celis Rojas
  "54168334": { primary: "NUMBER_8", secondary: "PROP", division: "pre-intermedia" }, // Ignacio Donaire Adaros
  "54168293": { primary: "SCRUM_HALF", division: "pre-intermedia" }, // Javier Sandoval carrera
  "54206233": { primary: "PROP", division: "pre-intermedia" }, // Jose Henriquez Calfuqueo
  "54168325": { primary: "FULLBACK", division: "pre-intermedia" }, // Jose Tomas Marin Diaz
  "54168295": { primary: "FLANKER", division: "pre-intermedia" }, // Kurt Wande Ortiz
  "54168364": { primary: "WING", division: "pre-intermedia" }, // Lucas Arevalo Cea
  "54168323": { primary: "CENTER", division: "pre-intermedia" }, // matias carrera subiabre
  "54168297": { primary: "FLANKER", division: "pre-intermedia" }, // Matias Ignacio Cardemil Guzman
  "54168301": { primary: "HOOKER", division: "pre-intermedia" }, // Maxi López
  "54257498": { primary: "CENTER", division: "pre-intermedia" }, // Pablo Romero
  "54239016": { primary: "FLY_HALF", division: "pre-intermedia" }, // Renato Alonso Miranda Aviles
  // UC
  "54168145": { primary: "FLANKER", division: "pre-intermedia" }, // agustin leon lara manriquez
  "54168210": { primary: "FLY_HALF", division: "pre-intermedia" }, // Benjamin Valdes covarrubias
  "54167681": { primary: "PROP", division: "pre-intermedia" }, // Cristóbal Escobar Valladares
  "54239303": { primary: "LOCK", division: "pre-intermedia" }, // Diego Esteban Cornejo Rosas
  "54167501": { primary: "WING", division: "pre-intermedia" }, // Hernan Ruiz Bravo
  "54168160": { primary: "FLANKER", division: "pre-intermedia" }, // ignacio Jose Roman Bulnes
  "54167493": { primary: "WING", division: "pre-intermedia" }, // Joaquin Baraona Prat
  "54167572": { primary: "SCRUM_HALF", division: "pre-intermedia" }, // José Ignacio Galdames Preece
  "54167466": { primary: "LOCK", secondary: "PROP", division: "pre-intermedia" }, // Jose Reyes Moreno
  "54225593": { primary: "FULLBACK", division: "pre-intermedia" }, // Máximo Speciali
  "54189939": { primary: "HOOKER", secondary: "PROP", division: "pre-intermedia" }, // Nivolas Astorga amunategui
  "54268952": { primary: "CENTER", division: "pre-intermedia" }, // raul duhalde errazuriz
  "54167459": { primary: "NUMBER_8", division: "pre-intermedia" }, // Rodrigo Donoso Durante
  "54167626": { primary: "CENTER", division: "pre-intermedia" }, // Santiago José Izurieta Huerta
};
