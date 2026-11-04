// The directory's content. To add a simulation, add an entry to SIMULATIONS:
//   categories: one or more ids from CATEGORIES (the first is its main subject)
//   art: key into SIM_ART in app.js, or leave it out to use the subject's icon
//   preview: 10 s muted gameplay clip that plays over the cover on hover (16:9 mp4, e.g. previews/ph.mp4)
//   image: path to a screenshot to use as the cover instead of art (16:9, e.g. assets/cochlea.jpg)
//   description: one or two sentences shown on the card
//   about: a short paragraph shown in the "How to use" window
//   manual: the steps shown in the "How to use" window

window.CATEGORIES = [
  { id: "biology",     name: "Biology",     blurb: "Living things, from cells to ecosystems." },
  { id: "physics",     name: "Physics",     blurb: "Forces, motion and energy." },
  { id: "astronomy",   name: "Astronomy",   blurb: "The Moon, planets, stars and beyond." },
  { id: "mathematics", name: "Mathematics", blurb: "Shapes, patterns and numbers in action." },
  { id: "chemistry",   name: "Chemistry",   blurb: "Atoms, molecules and reactions." },
  { id: "geography",   name: "Geography",   blurb: "Maps, places and the shape of our planet." }
];

window.SIMULATIONS = [
  // ---------- Biology ----------
  {
    title: "Forest Ecosystem Lab",
    url: "https://claude.ai/artifact/A823nRU8JrUPHVF9zCqmri",
    preview: "previews/forest.mp4",
    categories: ["biology"],
    art: "forest",
    description: "Wolves, deer and plants live, hunt and die animal by animal in a 3D northern forest. Change the rules of nature and watch the populations rise and crash.",
    features: ["14 species", "Population graph", "Hunt cam"],
    about: "A living 3D forest where every wolf, deer and plant is simulated on its own. Energy flows from plants to deer to wolves, so a small change, like faster plant growth or fewer wolves, can ripple through the whole ecosystem.",
    manual: [
      "Watch the <b>Populations over time</b> graph as wolves, deer and plants rise and fall.",
      "Change how nature works with sliders such as <b>Plant growth</b>, <b>Deer thirst</b> and <b>Wolf capture chance</b>.",
      "Set <b>Initial populations</b> and press <b>Reset with these populations</b>, or use <b>Change the current run</b> to remove or reintroduce wolves and deer mid-run.",
      "Click an animal to see its energy, hunger, hydration and stamina. Turn on <b>Hunt cam</b> to follow a chase.",
      "Press <b>Save this run to the graph</b> to compare experiments, and try the <b>Hypotheses to test</b>.",
      "Drag to orbit the camera, scroll to zoom and right-drag to pan."
    ]
  },
  {
    title: "Cochlea Simulator",
    url: "https://incomparable-griffin-c6f96d.netlify.app/",
    preview: "previews/cochlea.mp4",
    categories: ["biology", "physics"],
    image: "assets/cochlea.jpg",
    description: "Play any song through a 3D cochlea and watch your inner ear sort sound into pitch, with high notes at the base and low notes deep in the spiral.",
    features: ["Your own audio", "Hair cells in 3D", "Live pitch map"],
    about: "Sound makes the fluid inside the snail-shaped cochlea move. The basilar membrane is stiff at the base and floppy at the apex, so each pitch makes it vibrate most in a different place. There, hair cells bend and fire the auditory nerve, and your brain reads which cells fired as pitch and how strongly as loudness.",
    manual: [
      "Drop an MP3 or any audio file onto the page, or press <b>Choose audio file</b>.",
      "Or press <b>Play demo track</b>, <b>Use microphone</b>, or <b>Listen to a tab</b> to hear a YouTube video (Chrome or Edge on a computer).",
      "Watch the membrane and hair cells move, and follow <b>What the ear hears</b> to see which pitches are playing, from high to low.",
      "Open <b>How it works</b> for a step-by-step explanation of hearing.",
      "Turn <b>Labels</b> and <b>Orbit</b> on or off, and pick a colour <b>Theme</b>. Lower the number of <b>Cells</b> if it runs slowly.",
      "Drag to orbit the cochlea and scroll to zoom."
    ]
  },
  {
    title: "Formica Ant Colony",
    url: "https://claude.ai/artifact/SdzwgK965eDU6Jwn2apbtM",
    preview: "previews/ant.mp4",
    categories: ["biology"],
    image: "assets/ant-colony.jpg",
    description: "Watch an ant colony forage, dig tunnels and raise its young underground, then add food, predators and rival colonies to see how it copes.",
    features: ["Open sandbox", "Pheromone trails", "Rival colonies"],
    about: "A cross-section of soil where every ant has a job. Workers lay scent trails to food that other foragers follow, nurses raise eggs into larvae and pupae, and diggers carve out tunnels and pile the soil into an ant hill. Spiders, beetles, rain and cold all test the colony, and rival colonies may raid it.",
    manual: [
      "Pick a tool from <b>Tools</b>, such as <b>Dig</b>, <b>Food</b>, <b>Ants</b>, <b>Queen</b>, <b>Rival</b> or <b>Predator</b>, then click or drag on the world. Keys <kbd>1</kbd>–<kbd>0</kbd> and <kbd>X</kbd> pick tools, and <kbd>[</kbd> <kbd>]</kbd> change the brush size.",
      "Use <b>Chambers</b> to paint storage, nursery and queen rooms. The ants find their way there through the tunnels.",
      "Follow each colony under <b>Colonies</b>: workers, soldiers, eggs, larvae, pupae, <b>Food reserves</b> and <b>Colony health</b>. Change the <b>Soldier ratio</b> or turn on <b>Raid enemies</b>.",
      "Under <b>Environment</b>, change the <b>Time of day</b>, <b>Weather</b> and <b>Base temperature</b>.",
      "Press <kbd>P</kbd> to see the pheromone trails. Use <b>Inspect</b> to click an ant, then <b>Follow</b> it.",
      "Scroll to zoom and right-drag to pan. <kbd>Space</kbd> pauses, the speed buttons go up to 8×, and <kbd>H</kbd> shows all controls."
    ]
  },
  {
    title: "Virus Outbreak Simulator",
    url: "https://claude.ai/artifact/WJETDmEiWESH19sBAv9yEf",
    preview: "previews/virus.mp4",
    categories: ["biology"],
    image: "assets/virus-outbreak.jpg",
    description: "Follow a virus as it spreads through a small city of 700 people, then try masks, vaccines, quarantine and lockdown to flatten the curve.",
    features: ["SEIR model", "4 interventions", "Epidemic curve"],
    about: "Every dot is a person with a home and a daily routine of work, school, shops and parks. The virus spreads when an infectious person spends time close to a healthy one, and each person moves from susceptible to exposed, infectious and recovered. This is a simplified teaching model, not a prediction of any real disease.",
    manual: [
      "Pick a disease preset, <b>Default</b>, <b>Mild</b>, <b>Highly contagious</b> or <b>Slow &amp; severe</b>, or set <b>Transmission probability</b>, <b>Incubation period</b>, <b>Infectious duration</b> and <b>Disease severity</b> yourself.",
      "Press <b>Pause</b> or <b>Reset</b>, and choose a speed from 0.5× to 16×.",
      "Under <b>Interventions</b>, turn on <b>Masks</b>, <b>Vaccination campaign</b>, <b>Quarantine</b> or <b>Lockdown</b> and set how many people take part.",
      "Watch the <b>Population</b> numbers, the <b>Epidemic curve</b> and <b>Hospital capacity</b>. When the beds run out, more severe cases die.",
      "Click any person to open the <b>Inspector</b> and see their routine and who infected them. You can also <b>Infect</b> or <b>Vaccinate</b> them.",
      "Read <b>About the model</b> for how it works. Shortcuts: <kbd>Space</kbd> pauses, <kbd>R</kbd> resets, <kbd>1</kbd>–<kbd>6</kbd> set the speed."
    ]
  },

  // ---------- Physics ----------
  {
    title: "Simple Pendulum",
    url: "https://claude.ai/artifact/WK5Qw4Bkfvamq8zLNEKoNq",
    preview: "previews/pendulum.mp4",
    categories: ["physics"],
    art: "pendulum",
    description: "Swing a 3D pendulum and change its length, angle and gravity while the energy bars trade kinetic for potential energy.",
    features: ["Energy graph", "Force vectors", "Adjustable gravity"],
    about: "A 3D pendulum that swings with real physics. As it swings, energy keeps changing between kinetic energy (movement) and gravitational potential energy (height), while the total stays the same.",
    manual: [
      "Set the <b>Pendulum length</b>, <b>Maximum angle</b> and <b>Gravity</b> with the sliders.",
      "Press <b>Start</b> to let it swing, <b>Pause</b> to freeze it and <b>Reset</b> to bring it back.",
      "Watch the <b>KE</b> and <b>GPE</b> bars trade energy on every swing.",
      "Under <b>Display</b>, show forces, acceleration, velocity or axes. <b>Scale vector lengths</b> makes the arrows easier to see.",
      "Drag to orbit the camera and scroll to zoom. Shortcuts: <kbd>Space</kbd> starts or pauses, <kbd>R</kbd> resets."
    ]
  },
  {
    title: "Einstein's Mirror",
    url: "https://claude.ai/artifact/NbLSXMiaRJ94ykhuoWPdQ3",
    preview: "previews/einstein.mp4",
    categories: ["physics"],
    art: "mirror",
    description: "Could you see yourself in a mirror while travelling at nearly the speed of light? Ride a relativistic train and find out.",
    features: ["Train & track frames", "Light clock", "Guided experiments"],
    about: "Einstein once asked whether you could still see your reflection if you flew at almost the speed of light. Put a mirror on a fast train and watch the same flash of light from the train and from the track: both observers measure the same speed of light, but disagree about time.",
    manual: [
      "Set the <b>Train velocity</b> with the slider.",
      "Choose where the mirror sits: <b>In front</b>, or <b>Above (light clock)</b>, and set the <b>Distance to the mirror</b>.",
      "Switch between <b>Train frame</b> and <b>Track frame</b> to compare what each observer sees.",
      "Read the <b>Live data</b>: the Lorentz factor γ, the round-trip time on the train clock and the measured speed of light.",
      "Try the <b>Experiments</b>, such as <b>Start at rest and speed up</b>. Turn on <b>Slow motion</b> for a closer look.",
      "Shortcuts: <kbd>Space</kbd> plays or pauses, <kbd>←</kbd> <kbd>→</kbd> step, <kbd>R</kbd> resets."
    ]
  },
  {
    title: "Time Dilation Lab",
    url: "https://claude.ai/artifact/MnCwBKGHU5SsHhej2pNdik",
    preview: "previews/timedilation.mp4",
    categories: ["physics"],
    art: "lightclock",
    description: "Compare a clock on Earth with a clock on a fast spaceship, and watch light clocks tick slower as the ship nears the speed of light.",
    features: ["Light clocks", "Reference frames", "Guided scenarios"],
    about: "Special relativity says moving clocks tick slower. Send a spaceship off at any speed and compare how much time passes on Earth with how much passes for the crew. At everyday speeds the difference is tiny; near the speed of light it becomes enormous.",
    manual: [
      "Set the ship's <b>Speed</b> and the <b>Simulation speed</b>.",
      "Choose an <b>Experiment duration</b>. The run stops when Earth's clock reaches it.",
      "Switch the <b>Reference frame</b> to see the trip from Earth or from the ship.",
      "In <b>Live statistics</b>, compare Earth elapsed time Δt with the ship's proper time Δτ.",
      "In the <b>Light clock experiment</b>, compare <b>Ticks at rest</b> with <b>Ticks moving</b>.",
      "Try the <b>Guided scenarios</b>, such as <b>Fly at 99% c for 50 Earth years</b>. <kbd>Space</kbd> plays or pauses, <kbd>R</kbd> resets."
    ]
  },
  {
    title: "Photon Lab",
    url: "https://claude.ai/artifact/JKwHzzmJTRzApVUiyLq32w",
    preview: "previews/photon.mp4",
    categories: ["physics"],
    art: "prism",
    description: "Build an optics bench with lasers, mirrors, lenses and prisms, and trace how light reflects, refracts and splits into a rainbow.",
    features: ["12 experiments", "Real materials", "Ray tracing"],
    about: "A 2D optics lab that traces every ray of light as it bounces off mirrors, bends through glass and water, and spreads into colours in a prism. Each material has its own refractive index, so you can test the law of reflection, Snell's law, total internal reflection and dispersion for yourself.",
    manual: [
      "Open the <b>Experiments</b> menu at the top to load a ready-made scene, such as <b>Prism rainbow dispersion</b> or <b>Total internal reflection</b>.",
      "Add parts from the object library: <b>Light Sources</b>, <b>Mirrors</b>, <b>Lenses</b>, <b>Glass</b> and <b>Measuring Tools</b>. Click one to add it, or drag it onto the canvas.",
      "Select an object to change it in the properties panel, such as a laser's <b>Wavelength</b>, a lens's <b>Focal length</b> or a glass's <b>Material</b>.",
      "Turn on <b>Normals</b> and <b>Angles</b> to see the angles of incidence, reflection and refraction. Use the <b>Ruler</b>, <b>Protractor</b> and <b>Light Detector</b> to measure.",
      "Check <b>Energy Balance</b> to see how much light is emitted, absorbed, detected or escapes.",
      "Drag empty space to pan and scroll to zoom. Shortcuts: <kbd>R</kbd> rotates, <kbd>Del</kbd> deletes, <kbd>Ctrl</kbd>+<kbd>D</kbd> duplicates, <kbd>Ctrl</kbd>+<kbd>Z</kbd> undoes, <kbd>F</kbd> fits the view."
    ]
  },
  {
    title: "Marble Race Creator",
    url: "https://claude.ai/artifact/PLcsiXAh1JMjcBoM98LLaX",
    preview: "previews/marble.mp4",
    categories: ["physics"],
    image: "assets/marble-race.jpg",
    description: "Build a 3D marble run from ramps, loops, spirals and jumps, then race up to a pack of marbles down it and see which one wins.",
    features: ["17 track pieces", "Live leaderboard", "Cinematic camera"],
    about: "A 3D track builder where gravity does the racing. Snap together straights, curves, steep drops, loops, spirals, jumps, funnels and spinners, then release the marbles. Their speed comes from how far they fall, so a loop only works with enough drop before it, and peg boards and spinners shuffle the order.",
    manual: [
      "Drag pieces from the left panel onto the ground, or click a piece and then click to place it. Pieces snap to open track ends (the green arrows).",
      "Connect a <b>Start Gate</b> to a <b>Finish Line</b> with track, then press <b>Race</b> or <kbd>Space</kbd>.",
      "Select a piece to move it. <kbd>R</kbd> rotates it, <kbd>E</kbd> and <kbd>Q</kbd> raise and lower it, <kbd>Ctrl</kbd>+<kbd>D</kbd> duplicates and <kbd>Del</kbd> deletes.",
      "Set the number of <b>marbles</b> and the <b>Speed</b>, or turn on <b>Slow-mo</b> (<kbd>T</kbd>). Watch the positions and times on the leaderboard.",
      "Switch the camera between <b>Orbit</b>, <b>Follow</b> (<kbd>F</kbd>, or <kbd>1</kbd>–<kbd>9</kbd> to follow a position) and <b>Cinematic</b> (<kbd>C</kbd>). <kbd>H</kbd> frames the whole track.",
      "Left-drag to orbit, right-drag or <kbd>WASD</kbd> to pan, and scroll to zoom. Tip: loops need a run-up of about 4 levels of drop."
    ]
  },

  // ---------- Astronomy ----------
  {
    title: "Lunar Phase Simulator",
    url: "https://claude.ai/artifact/Keha6EZSYNKAFcVVPMD4hS",
    preview: "previews/lunar.mp4",
    categories: ["astronomy"],
    art: "moon",
    description: "Drag the Moon around its orbit and watch its phase change, as seen from Earth and from an observer's horizon.",
    features: ["Orbit view", "Moon from Earth", "Time stepping"],
    about: "A top-down view of the Earth and Moon, with sunlight coming from the right. As the Moon travels its 29.5-day orbit, the side panels show its phase as seen from Earth and where it sits in an observer's sky.",
    manual: [
      "Press <b>Start Animation</b> to set the Moon moving, and change the <b>Animation rate</b> with the slider.",
      "Drag the Moon around its orbit to jump to any phase, or drag the Earth to turn it.",
      "Use the <b>Day</b>, <b>Hour</b>, <b>Minute</b> and <b>Lunar phase</b> + / − buttons to step through time exactly.",
      "Watch <b>The Moon from Earth</b> and <b>Observer Horizon</b> panels to see the phase and where the Moon is in the sky.",
      "Under <b>Diagram options</b>, show the angle, a lunar landmark or time tick marks."
    ]
  },
  {
    title: "My Solar System 3D",
    url: "https://claude.ai/artifact/P3CgFbVntUJpM9z2UQBq78",
    preview: "previews/solar.mp4",
    categories: ["astronomy", "physics"],
    art: "orbits",
    description: "Build your own system of suns, planets and moons, then watch gravity pull them into orbits, ellipses and figure-8s.",
    features: ["9 presets", "Up to 4 bodies", "Gravity vectors"],
    about: "A 3D gravity sandbox for up to four bodies. Start from a ready-made system or set the masses, positions and speeds yourself, and watch gravity turn them into circles, ellipses, figure-8s or collisions.",
    manual: [
      "Pick a system from <b>Presets</b>, such as <b>Sun &amp; Planet</b>, <b>Binary Star</b> or <b>Figure-8 Dance</b>.",
      "Press <b>Play</b>. Use <b>Slow</b>, <b>Normal</b> or <b>Fast</b> to change speed, and <b>Pause</b>, <b>Step</b> or <b>Restart</b> to control time.",
      "Drag a body to move it, and drag the tip of its green arrow to change its speed and direction.",
      "In the <b>Mass</b> panel, add or remove bodies (up to 4) and slide each body's mass.",
      "Turn on <b>Path</b>, <b>Velocity</b>, <b>Gravity Force</b> or <b>Center of Mass</b> to see what is happening.",
      "Right-drag to orbit the camera and scroll to zoom. <b>Follow</b> keeps the camera on one body."
    ]
  },

  // ---------- Mathematics ----------
  {
    title: "Pythagorean Lab",
    url: "https://claude.ai/artifact/U9DbMDd19cKHPbminEGVF9",
    preview: "previews/pythag.mp4",
    categories: ["mathematics"],
    art: "pythagoras",
    description: "Drag the corners of a right triangle and watch the squares on its sides prove that a² + b² = c².",
    features: ["Draggable triangle", "Pythagorean triples", "Animated proof"],
    about: "A right triangle with a square built on each side. However you change the triangle, the areas of the two smaller squares always add up to the area of the largest one: a² + b² = c².",
    manual: [
      "Drag vertex <b>A</b> to change side b, and vertex <b>B</b> to change side a.",
      "Drag vertex <b>C</b> to swing the triangle around its hypotenuse.",
      "Or use <b>Adjust the legs</b>, or pick one of the <b>Pythagorean triples</b> such as 3-4-5.",
      "Check the <b>Measurements</b> table and the <b>Area balance</b> to compare the squares.",
      "Press <b>Animate proof</b> to watch the squares rearrange into a proof."
    ]
  },
  {
    title: "Galton Board",
    url: "https://claude.ai/artifact/W5gXBeUf39N48G8kQjHqSg",
    preview: "previews/galton.mp4",
    categories: ["mathematics"],
    art: "galton",
    description: "Drop balls through rows of pegs and watch random left-right bounces build a bell curve.",
    features: ["Up to 5,000 balls", "Binomial curve", "Live statistics"],
    about: "Each ball bounces left or right at random on every peg, so no one can predict where a single ball will land. Drop hundreds, though, and they pile up into a predictable shape: the binomial distribution, which looks more and more like a normal bell curve as you add rows.",
    manual: [
      "Press <b>Drop Balls</b> to start, or <b>Single Ball</b> to follow one ball's path.",
      "Choose a <b>Ball count</b>: 100, 500, 1,000 or 5,000.",
      "Change the <b>Peg rows</b>, the <b>Drop speed</b> and the <b>Probability of bouncing right</b>. Changing rows or probability starts a new experiment.",
      "Compare the observed histogram with the binomial curve. Turn on <b>Normal approx.</b> to overlay the bell curve.",
      "Check <b>Live statistics</b> for the mean, the standard deviation and the χ² goodness of fit.",
      "Shortcuts: <kbd>Space</kbd> drops or pauses, <kbd>S</kbd> drops a single ball, <kbd>R</kbd> resets."
    ]
  },
  {
    title: "Unit Circle Waves",
    url: "https://claude.ai/artifact/PPUxyEv2ojAwsgCZvL4LR1",
    preview: "previews/unitcircle.mp4",
    categories: ["mathematics"],
    art: "unitcircle",
    description: "Watch a point rotating around the unit circle draw sine and cosine waves, then change amplitude, frequency and phase.",
    features: ["Sine & cosine", "Wave parameters", "Challenge mode"],
    about: "A point travels around a circle of radius 1. Its height is sin θ and its sideways position is cos θ, so as it turns it draws the sine and cosine waves. Change the amplitude, frequency and phase to see how each one reshapes the wave.",
    manual: [
      "Press <b>Play</b> or <b>Pause</b>, or turn on <b>Slow motion</b>. You can also drag the point or the graph yourself.",
      "Use the <b>Angle θ</b> slider or the <b>Special angles</b> buttons to jump to an exact angle.",
      "Choose what is drawn with <b>Sine</b>, <b>Cosine</b>, <b>Trace</b> and <b>Compare</b>.",
      "Change <b>Rotation speed</b>, <b>Amplitude A</b>, <b>Frequency ω</b> and <b>Phase shift φ</b> under <b>Wave parameters</b>.",
      "Read sin θ, cos θ and tan θ in <b>Live data</b>, or drag the highlighted numbers in the <b>Interactive formula</b>.",
      "Press <b>Start challenge</b> to predict sine and cosine values for random angles."
    ]
  },

  // ---------- Chemistry ----------
  {
    title: "Atom Builder",
    url: "https://claude.ai/artifact/XvLMEeJrVQMohr3pmyoZDC",
    preview: "previews/atom.mp4",
    categories: ["chemistry", "physics"],
    art: "atom",
    description: "Add protons, neutrons and electrons to build an atom in 3D and see how its structure decides which element it is.",
    features: ["Bohr model", "Isotopes & ions", "Periodic table 1–36"],
    about: "Build an atom particle by particle. The number of protons decides which element it is, extra or missing neutrons make a different isotope, and extra or missing electrons turn it into a charged ion.",
    manual: [
      "Use the <b>Build your atom</b> panel to add or remove protons, neutrons and electrons.",
      "Watch the <b>Element information</b> update with the element's name, mass and charge.",
      "Pick an element from the <b>Periodic table</b> (elements 1–36) to jump straight to it.",
      "Press <b>Make neutral</b> to give the atom as many electrons as protons.",
      "Tap a shell under <b>Electron shells</b> to highlight it. Drag to rotate the atom and press <b>Reset view</b> to recentre it."
    ]
  },
  {
    title: "pH Lab",
    url: "https://claude.ai/artifact/4YZnCUAE9V4qemVhrKMREp",
    preview: "previews/ph.mp4",
    categories: ["chemistry"],
    art: "ph",
    description: "Mix acids, bases and water in a 3D beaker and see how the pH scale works.",
    features: ["Everyday substances", "H⁺ and OH⁻ ions", "Lab notebook"],
    about: "A 3D beaker where you mix everyday liquids, like lemon juice, vinegar, coffee and soapy water, and watch the pH change. The pH comes from the balance of hydrogen ions (H⁺) and hydroxide ions (OH⁻), which decides whether a solution is acidic, neutral or basic.",
    manual: [
      "Choose a liquid from <b>Substances</b> and add it to the beaker.",
      "Use <b>Set the solution's pH</b>, or <b>Pour out half</b> and top up with water to dilute it.",
      "Watch the colour and the pH scale move between acidic and <b>more basic (alkaline)</b>.",
      "Read the <b>Chemistry readout</b> for hydrogen ions [H⁺] and hydroxide ions [OH⁻].",
      "Note your results in the <b>Lab notebook</b>, and use <b>Compare two solutions</b> to put two side by side."
    ]
  },

  // ---------- Geography ----------
  {
    title: "Equal Earth Projection",
    url: "https://claude.ai/artifact/1EGzjD2gBoQNxTd4QEVYyL",
    preview: "previews/equal-earth.mp4",
    categories: ["geography"],
    art: "map",
    description: "Compare any two countries on an Equal Earth map and a Mercator map to see how much Mercator inflates their size.",
    features: ["Two maps", "Country compare", "Guessing game"],
    about: "Two world maps side by side. The Equal Earth projection shows every country at its true size, while the familiar Mercator map stretches places far from the equator. Africa is 14 times bigger than Greenland, yet on Mercator they look about the same.",
    manual: [
      "Choose a country in <b>Selected country or region</b> and another in <b>Compare with</b>.",
      "Or click a quick comparison such as <b>Greenland vs Africa</b>.",
      "Click any country on either map to pick it.",
      "Scroll or pinch to zoom, drag to move around, or use the + / − buttons on each map.",
      "Use <b>Map center</b> to centre both maps on the selected or compared place."
    ]
  },
  {
    title: "Earth Sandbox",
    url: "https://claude.ai/artifact/RHxpsrrFUz8Tzqo1MPo3RZ",
    preview: "previews/earth.mp4",
    categories: ["geography"],
    art: "terrain",
    description: "Raise mountains, flood coasts and change the climate of a living world map, then see how habitable your planet becomes.",
    features: ["Terrain tools", "Climate sliders", "Habitability score"],
    about: "A world map you can reshape. Paint mountains and seas, warm or cool the planet, and change the rainfall, then watch biomes shift over the years and see how liveable the world becomes.",
    manual: [
      "Pick a tool from the bottom dock: <b>Move</b>, <b>Raise</b>, <b>Lower</b>, <b>Water</b>, <b>Temp</b> or <b>Rain</b> (keys <kbd>1</kbd>–<kbd>6</kbd>). Then paint on the map.",
      "Change the brush size with the <b>Brush</b> slider.",
      "Use the <b>Climate</b> sliders to change <b>Global temperature</b>, <b>Rainfall</b> and <b>Sea level</b> for the whole planet.",
      "Watch the <b>Habitability</b> score and its factors: mild climate, fresh water and ice-free land.",
      "Switch the <b>Map view</b> between <b>Biomes</b>, <b>Temp</b>, <b>Rain</b>, <b>Height</b> and <b>People</b>.",
      "Press <b>Real Earth</b> to load our planet, or <b>Random</b> to make a brand-new world. <b>Pause</b>, <b>Reset</b> and <b>Speed</b> control time. Scroll to zoom and right-drag to move. <kbd>P</kbd> pauses."
    ]
  },
  {
    title: "Water Cycle Simulator",
    url: "https://claude.ai/artifact/P9QfrQhSbov94xhGyd1PXd",
    preview: "previews/water.mp4",
    categories: ["geography"],
    art: "watercycle",
    description: "Change the temperature, sunlight and weather in a 3D landscape and watch water evaporate, condense, rain, freeze and flow.",
    features: ["6 processes", "Weather modes", "H₂O molecules"],
    about: "A 3D landscape where water keeps moving between sea, sky and land. Warm it, cool it or change the weather to see evaporation, condensation, precipitation, freezing, melting and runoff happen. A molecule view shows what H₂O looks like as ice, liquid water and vapour.",
    manual: [
      "Use the <b>Temperature</b> and <b>Sunlight</b> sliders to warm or cool the world.",
      "Choose the <b>Weather</b>: <b>Sunny</b>, <b>Rainy</b> or <b>Snowy</b>.",
      "In the <b>Water cycle</b> panel, watch the six processes and click one, or a label in the scene, to learn about it.",
      "See the <b>States of water</b> panel show H₂O molecules as ice, liquid water or vapour.",
      "Change the <b>Simulation speed</b> or pause. Drag to orbit and scroll to zoom."
    ]
  }
];
