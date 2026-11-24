/* ==========================================================================
 *  WorldLatent: public project page (arXiv version), CONTENT FILE
 *
 *  This is the only file you need to edit to add, remove or reorder videos.
 *  The layout lives in index.html (text + styles) and static/js/page.js.
 *
 *  Conventions
 *  - Paths are relative to HTML_arxiv/index.html, e.g. "static/videos/gen/dog/rgb.mp4".
 *  - Videos must be H.264 .mp4.
 *  - `prompt` / `note` fields accept plain text or simple HTML (<b>, <i>, <br>).
 *    Use backticks (`...`) so quotes inside prompts need no escaping.
 *  - `rate` (optional) is a per-example playback multiplier. The 17-frame clips
 *    saved at 16 fps (~1.06 s long) use rate: 0.5 so they play at the same pace
 *    as the 8-fps clips (~2.1 s). Leave it out for 8-fps clips.
 *  - All videos inside one example play in sync and loop together.
 *  - A missing or misspelled path shows up on the page as a red box with the
 *    path in it, so typos are easy to spot.
 *  - "3D geometry + camera" clips are the per-frame point cloud + camera trajectory
 *    renders; use the *_smooth_se3 version whenever one exists.
 * ========================================================================== */

window.WL_CONTENT = {

  /* ------------------------------------------------------------------------
   * 1. 4D PERCEPTION  (arXiv: Figs. 3, 7, 8)
   *
   * `datasets`: one tab per dataset. Each example is one pre-made comparison
   *   grid video (13 labelled panels).
   *   To add a sequence:  { title: "Scene 0775", src: "static/videos/perception/<file>.mp4" }
   *
   * `ours`: examples shown as a row of separate clips (any number of clips).
   *   Set ours: true on a clip to highlight its label.
   *
   * `viewer`: the interactive 3D viewer shown after these examples, with a row of
   *   thumbnails to pick the scene (`zoom` > 1 starts closer than the automatic framing).
   *   Its data file is made by tools/make_viewer_data.py from a perception
   *   export bundle (manifest.json + points.bin + img/).
   * ---------------------------------------------------------------------- */
  perception: {
    datasets: [
      {
        name: "KITTI",
        examples: [
          { title: "Validation sequence 12", src: "static/videos/perception/kitti_seq12_grid.mp4" },
        ],
      },
      {
        name: "Sintel",
        examples: [
          { title: "alley_2", src: "static/videos/perception/sintel_alley2_grid.mp4" },
        ],
      },
      {
        name: "Bonn",
        examples: [
          { title: "person_tracking2", src: "static/videos/perception/bonn_person_tracking2_grid.mp4" },
        ],
      },
      {
        name: "ScanNet",
        examples: [
          { title: "scene0796_00", src: "static/videos/perception/scannet_scene0796_grid.mp4" },
        ],
      },
    ],

    ours: [
      {
        title: "KITTI: validation sequence 06",
        rate: 0.5,
        clips: [
          { label: "Input RGB",                  src: "static/videos/perception/kitti_seq06/input.mp4" },
          { label: "GT depth",                   src: "static/videos/perception/kitti_seq06/gt_depth.mp4" },
          { label: "Ours: depth",                src: "static/videos/perception/kitti_seq06/ours_depth.mp4",    ours: true },
          { label: "Ours: 3D geometry + camera", src: "static/videos/perception/kitti_seq06/ours_geometry.mp4", ours: true },
        ],
      },
    ],

    // Interactive 3D viewer below the examples: one thumbnail per scene, first one opens by default.
    // Each scene folder (scene.js, thumb.jpg, img/) is made by tools/make_viewer_data.py.
    viewer: {
      title: "Interactive 3D viewer",
      caption: "Our per-frame point clouds and estimated camera trajectories, each from a single input video. Pick a scene below.",
      scenes: [
        { dataset: "KITTI",     name: "Driving",         title: "KITTI: validation sequence 06", src: "static/viewer/kitti_seq06/scene.js",           thumb: "static/viewer/kitti_seq06/thumb.jpg" },
        { dataset: "EgoDex",    name: "Cloth folding",   title: "EgoDex: cloth folding",         src: "static/viewer/egodex_cloth_folding/scene.js", thumb: "static/viewer/egodex_cloth_folding/thumb.jpg" },
        { dataset: "DROID",     name: "Placing a block", title: "DROID: placing a block",        src: "static/viewer/droid_block/scene.js",          thumb: "static/viewer/droid_block/thumb.jpg" },
        { dataset: "Bonn",      name: "Person tracking", title: "Bonn: person tracking",         src: "static/viewer/bonn_person_tracking/scene.js", thumb: "static/viewer/bonn_person_tracking/thumb.jpg" },
        { dataset: "Bonn",      name: "Two people",      title: "Bonn: two people",              src: "static/viewer/bonn_two_people/scene.js",      thumb: "static/viewer/bonn_two_people/thumb.jpg" },
        { dataset: "Ego-Exo4D", name: "Cooking",         title: "Ego-Exo4D: cooking",            src: "static/viewer/egoexo4d_cooking/scene.js",     thumb: "static/viewer/egoexo4d_cooking/thumb.jpg" },
        { dataset: "HOI4D",     name: "Toy car",         title: "HOI4D: toy car",                src: "static/viewer/hoi4d_toy_car/scene.js",        thumb: "static/viewer/hoi4d_toy_car/thumb.jpg" },
        { dataset: "DROID",     name: "Robot pouring",   title: "DROID: robot pouring",          src: "static/viewer/droid_pouring/scene.js",        thumb: "static/viewer/droid_pouring/thumb.jpg" },
        { dataset: "Ego-Exo4D", name: "Bike repair",     title: "Ego-Exo4D: bike repair",        src: "static/viewer/egoexo4d_bike_repair/scene.js", thumb: "static/viewer/egoexo4d_bike_repair/thumb.jpg" },
      ],
    },
  },

  /* ------------------------------------------------------------------------
   * 2. DEPTH-CONDITIONED RE-RENDERING  (arXiv: Figs. 4, 9)
   *
   * Each example: the input video with our estimated depth and 3D geometry,
   * then any number of re-rendered outputs (one per text prompt).
   * ---------------------------------------------------------------------- */
  rerender: {
    examples: [
      /* ---- arXiv, Fig. 4 ---- */
      {
        title: "Robotic manipulation",
        source: "EgoDex",
        rate: 0.5,
        input: {
          rgb:      "static/videos/rerender/robot_lids/input.mp4",
          depth:    "static/videos/rerender/robot_lids/depth.mp4",
          geometry: "static/videos/rerender/robot_lids/geometry.mp4",
        },
        outputs: [
          {
            name: "Robotic hands in silver metallic gloves",
            src: "static/videos/rerender/robot_lids/silver_robotic_hands.mp4",
            prompt: `First-person view of bimanual dexterous robotic hands in silver metallic gloves fitting a round lid onto a white coffee cup on a wooden counter.`,
          },
          {
            name: "Blue-gloved laboratory hands",
            src: "static/videos/rerender/robot_lids/blue_gloved_hands.mp4",
            prompt: `First-person view of blue-gloved laboratory hands sealing a round lid onto a frosted white cup on a cleanroom workbench.`,
          },
        ],
      },
      {
        title: "Human-object interaction",
        source: "Bonn",
        rate: 0.5,
        input: {
          rgb:      "static/videos/rerender/balloon/input.mp4",
          depth:    "static/videos/rerender/balloon/depth.mp4",
          geometry: "static/videos/rerender/balloon/geometry.mp4",
        },
        outputs: [
          {
            name: "Sunlit Scandinavian artist loft studio",
            src: "static/videos/rerender/balloon/artist_loft_studio.mp4",
            prompt: `In a bright sun-drenched Scandinavian artist loft studio with warm white gallery walls and light oak hardwood flooring, a smiling artist in a warm terracotta knit sweater and blue denim jeans walks across the sunlit studio while playfully tapping a large bright golden-yellow balloon into the air with his outstretched right hand. Natural wooden worktables, art supplies, and a studio chair sit bathed in crisp golden morning sunlight. The camera tracks gently left.`,
          },
          {
            name: "Classical wood-paneled study library",
            src: "static/videos/rerender/balloon/wood_library.mp4",
            prompt: `In a warm classical wood-paneled study library illuminated by rich amber tungsten lamps, a scholar wearing a tailored forest-green tweed jacket and dark trousers walks across a vintage woven carpet while lightly batting a decorative antique crimson-and-gold globe balloon upward with his right hand. Polished mahogany desks, a leather study chair, and wooden book carts line the cozy room. The camera tracks gently left.`,
          },
        ],
      },
      {
        title: "Self-driving",
        source: "Waymo",
        rate: 0.5,
        input: {
          rgb:      "static/videos/rerender/waymo/input.mp4",
          depth:    "static/videos/rerender/waymo/depth.mp4",
          geometry: "static/videos/rerender/waymo/geometry.mp4",
        },
        outputs: [
          {
            name: "Sun-drenched California hillside street",
            src: "static/videos/rerender/waymo/sunlit_california.mp4",
            prompt: `A sun-drenched California hillside street slopes upward towards a distant hilltop under a crisp, cloudless azure sky. Pastel stucco and painted Victorian multi-story row houses line both sides of the bright sunlit asphalt roadway. Gleaming sedans and SUVs in cherry red, white, and silver sit parked along sunny curbsides under sharp midday shadows. Utility poles with overhead wires stretch down the right side of the street. The camera dollies quickly forward.`,
          },
          {
            name: "Snow-blanketed winter residential street",
            src: "static/videos/rerender/waymo/snowy_winter.mp4",
            prompt: `A snow-blanketed winter residential street slopes upward towards a frosted hilltop under a pale icy blue morning sky. Snow-draped multi-story row houses with icicles along their eaves line both sides of the plowed winter roadway. Parked sedans and SUVs capped with thick fresh white snow line snowbanked curbsides beneath frost-coated utility poles and wires. The camera dollies quickly forward.`,
          },
        ],
      },

      /* ---- arXiv appendix, Fig. 9 ---- */
      {
        title: "Kitchen inspection",
        source: "ScanNet",
        rate: 0.5,
        input: {
          rgb:      "static/videos/rerender/kitchen/input.mp4",
          depth:    "static/videos/rerender/kitchen/depth.mp4",
          geometry: "static/videos/rerender/kitchen/geometry.mp4",
        },
        outputs: [
          {
            name: "Cozy sage-green cottage kitchen",
            src: "static/videos/rerender/kitchen/sage_green_cottage.mp4",
            prompt: `A charming sunlit English cottage kitchen features painted sage-green wooden cabinets with vintage brass handles, a warm butcher-block countertop with a farmhouse sink and ceramic canisters, a classic range stove, and honey-toned wood floors. The camera dollies smoothly forward along the kitchen counter.`,
          },
          {
            name: "Sunlit marble modern kitchen",
            src: "static/videos/rerender/kitchen/sunlit_marble_modern.mp4",
            prompt: `A bright contemporary luxury kitchen bathed in morning sunlight features crisp matte-white shaker cabinets with brushed brass pulls, a veined Calacatta marble countertop with an undermount stainless sink, a stainless chef's range stove, and light blonde-oak hardwood floors. The camera dollies smoothly forward along the kitchen counter.`,
          },
        ],
      },
      {
        title: "Folding cloth",
        source: "EgoDex",
        input: {
          rgb:      "static/videos/rerender/fold_cloth/input.mp4",
          depth:    "static/videos/rerender/fold_cloth/depth.mp4",
          geometry: "static/videos/rerender/fold_cloth/geometry.mp4",
        },
        outputs: [
          {
            name: "Sunlit Scandinavian linen table",
            src: "static/videos/rerender/fold_cloth/scandinavian_linen.mp4",
            prompt: `Egocentric overhead view in a sunlit Scandinavian laundry studio as two hands neatly fold a warm terracotta linen shirt across a natural blonde-oak wooden table bathed in golden morning window light. Woven storage baskets rest softly at the upper edge of the bright wood surface. The camera tilts steadily up while dollying steadily forward.`,
          },
          {
            name: "Cleanroom garment station",
            src: "static/videos/rerender/fold_cloth/cleanroom_garment.mp4",
            prompt: `Egocentric overhead view inside an ultra-clean white semiconductor cleanroom station as two white-gloved technician hands precisely fold a crisp cyan sterile cleanroom smock on a polished stainless-steel inspection table under bright diffused ceiling panels. The camera tilts steadily up while dollying steadily forward.`,
          },
        ],
      },
      {
        title: "Multi-human tracking",
        source: "Bonn",
        input: {
          rgb:      "static/videos/rerender/multi_human/input.mp4",
          depth:    "static/videos/rerender/multi_human/depth.mp4",
          geometry: "static/videos/rerender/multi_human/geometry.mp4",
        },
        outputs: [
          {
            name: "Warm wood university seminar room",
            src: "static/videos/rerender/multi_human/wood_seminar_room.mp4",
            prompt: `In a warm wood-accented university seminar room with walnut desks, ergonomic chairs, and warm tungsten ceiling lights, two researchers in a forest-green fleece jacket and a heather-gray sweater step synchronously side-by-side across the floor. The camera tracks smoothly with their motion.`,
          },
          {
            name: "Sunlit collaborative studio",
            src: "static/videos/rerender/multi_human/sunlit_studio.mp4",
            prompt: `In a bright sunlit modern design studio with clean white walls, blonde-wood desks, and office chairs in the background, two colleagues wearing a cobalt-blue zip sweater and a light cream knit pullover step synchronously side-by-side in crisp natural daylight. The camera tracks smoothly with their motion.`,
          },
        ],
      },
    ],
  },

  /* ------------------------------------------------------------------------
   * 3. TEXT-TO-4D GENERATION  (arXiv: Figs. 5, 10)
   *
   * Each example: one text prompt and the three generated outputs.
   * Copy a block, point it at a new folder, paste the prompt.
   *
   * `viewer`: the interactive 3D viewer after the examples (same as in
   *   perception). A scene whose `title` equals an example's title shows that
   *   example's text prompt below the viewer. Data folders are made by
   *   tools/make_viewer_data.py from the text-to-4D export bundles.
   * ---------------------------------------------------------------------- */
  generation: {
    examples: [
      /* ---- arXiv, Fig. 5 ---- */
      {
        title: "Musician playing guitar",
        prompt: `Inside a cozy sunlit living room with light oak hardwood flooring, a beige fabric sofa, a potted monstera plant, and warm wooden bookshelves, a young musician in a rust-orange knit sweater sits on a wooden stool strumming an acoustic guitar with natural hand and body motion. The camera orbits gently left while dollying slowly forward.`,
        rgb:      "static/videos/gen/guitar/rgb.mp4",
        depth:    "static/videos/gen/guitar/depth.mp4",
        geometry: "static/videos/gen/guitar/geometry.mp4",
      },
      {
        title: "Coral reef with tropical fish",
        prompt: `A vibrant underwater coral reef scene features numerous tropical reef fish swimming actively through crystal-clear turquoise water. Electric-blue tangs, golden-yellow butterflyfish, and bright orange anthias glide across the reef near sculpted branching corals, porous limestone rocks, and a sunlit white sandy seabed floor under shimmering underwater caustics. The camera pedestals steadily up while tilting gently down.`,
        rgb:      "static/videos/gen/coral_reef/rgb.mp4",
        depth:    "static/videos/gen/coral_reef/depth.mp4",
        geometry: "static/videos/gen/coral_reef/geometry.mp4",
      },

      /* ---- arXiv appendix, Fig. 10 ---- */
      {
        title: "Lantern-lit street at night",
        prompt: `In a narrow Japanese lantern-lit street at night, pedestrians walk forward along a wet stone walkway lined with warm timber izakaya storefronts and glowing neon signage. In the foreground, a woman in a camel trench coat walks steadily forward beside a man in a charcoal jacket and dark jeans. Bright pink and warm-white illuminated shop panels line the right wall while red paper lanterns glow along the left eaves. The camera dollies steadily forward.`,
        rgb:      "static/videos/gen/tokyo/rgb.mp4",
        depth:    "static/videos/gen/tokyo/depth.mp4",
        geometry: "static/videos/gen/tokyo/geometry.mp4",
      },
      {
        title: "Rainy avenue",
        prompt: `A wet urban avenue during steady rainfall. A stone-paved sidewalk lined with maple trees and a trimmed green hedge curves to the right beside a steel guardrail bordering a multi-lane asphalt road. On the roadway, a dark navy sports sedan with bright warm headlights illuminated drives briskly forward through the rain. Fine water mist sprays from the rolling tires across reflective puddles under overcast skies. The camera dollies steadily forward.`,
        rgb:      "static/videos/gen/rain_street/rgb.mp4",
        depth:    "static/videos/gen/rain_street/depth.mp4",
        geometry: "static/videos/gen/rain_street/geometry.mp4",
      },
      {
        title: "Golden retriever puppy",
        prompt: `A fluffy golden retriever puppy stands on a woven cream rug over patterned terracotta-and-beige ceramic floor tiles in a sunlit room. To the right of the puppy sits a raised wooden pet bed with a soft mustard cushion. In the background, a wicker toy basket rests beside a dark oak sideboard cabinet. Across the sequence, the puppy trots eagerly forward across the rug toward the foreground while wagging its tail. The camera pans gently left.`,
        rgb:      "static/videos/gen/dog/rgb.mp4",
        depth:    "static/videos/gen/dog/depth.mp4",
        geometry: "static/videos/gen/dog/geometry.mp4",
      },
      {
        title: "Riverside jogger",
        prompt: `Along a wide stone riverside promenade with a metal railing overlooking calm rippling water and distant bridges in warm morning sunlight, an athletic runner in a royal-blue tracksuit and white sneakers jogs smoothly across the foreground. The camera trucks steadily right while dollying forward.`,
        rgb:      "static/videos/gen/joggler/rgb.mp4",
        depth:    "static/videos/gen/joggler/depth.mp4",
        geometry: "static/videos/gen/joggler/geometry.mp4",
      },
      {
        title: "Red sedan by a pine forest",
        prompt: `A crimson-red sedan drives smoothly forward along a sunlit asphalt roadway near a stone park entrance surrounded by tall green pine trees and lush foliage. The vehicle travels steadily down the lane, passing crisp white crosswalk stripes painted on the pavement. Golden afternoon sunlight filters through the overhead pine canopy onto the road and wooden park fencing, casting dappled shadows across the scene. The camera dollies slowly forward.`,
        rgb:      "static/videos/gen/red_car_forest/rgb.mp4",
        depth:    "static/videos/gen/red_car_forest/depth.mp4",
        geometry: "static/videos/gen/red_car_forest/geometry.mp4",
      },
      {
        title: "Mountain waterfall",
        prompt: `A powerful mountain waterfall cascades over dark basalt boulders, generating billowing white mist and churning turquoise foam. In the foreground, a dark iron observation railing with wire mesh panels borders a wet stone overlook. Across the rushing river, an emerald grassy hillside rises toward pine trees and a timber lodge with a reddish-brown shingle roof under a crisp blue sky. The camera pans steadily left while dollying slowly forward.`,
        rgb:      "static/videos/gen/waterfall/rgb.mp4",
        depth:    "static/videos/gen/waterfall/depth.mp4",
        geometry: "static/videos/gen/waterfall/geometry.mp4",
      },
    ],

    // Interactive 3D viewer below the examples: one thumbnail per generated scene.
    viewer: {
      id: "generation-viewer",
      title: "Interactive 3D viewer",
      caption: "The generated 4D scenes above as per-frame point clouds with their camera trajectories, lifted from the generated depth and cameras. Pick a scene below.",
      labels: { frame: "Generated frame", depth: "Generated depth, this frame", trajectory: "Generated camera trajectory", camera: "generated camera" },
      scenes: [
        { name: "Musician playing guitar",       title: "Musician playing guitar",       src: "static/viewer/gen/guitar/scene.js",           thumb: "static/viewer/gen/guitar/thumb.jpg" },
        { name: "Coral reef with tropical fish", title: "Coral reef with tropical fish", src: "static/viewer/gen/coral_reef/scene.js",       thumb: "static/viewer/gen/coral_reef/thumb.jpg" },
        { name: "Lantern-lit street at night",   title: "Lantern-lit street at night",   src: "static/viewer/gen/lantern_street/scene.js",   thumb: "static/viewer/gen/lantern_street/thumb.jpg" },
        { name: "Rainy avenue",                  title: "Rainy avenue",                  src: "static/viewer/gen/rainy_avenue/scene.js",     thumb: "static/viewer/gen/rainy_avenue/thumb.jpg" },
        { name: "Golden retriever puppy",        title: "Golden retriever puppy",        src: "static/viewer/gen/golden_retriever/scene.js", thumb: "static/viewer/gen/golden_retriever/thumb.jpg" },
        { name: "Riverside jogger",              title: "Riverside jogger",              src: "static/viewer/gen/jogger/scene.js",           thumb: "static/viewer/gen/jogger/thumb.jpg" },
        { name: "Red sedan by a pine forest",    title: "Red sedan by a pine forest",    src: "static/viewer/gen/red_sedan/scene.js",        thumb: "static/viewer/gen/red_sedan/thumb.jpg" },
        { name: "Mountain waterfall",            title: "Mountain waterfall",            src: "static/viewer/gen/waterfall/scene.js",        thumb: "static/viewer/gen/waterfall/thumb.jpg" },
      ],
    },
  },

  /* ------------------------------------------------------------------------
   * 4. LATENT SUBSPACE DECOMPOSITION  (arXiv: Fig. 6)
   *
   * Each example is one grid video: columns = re-renders of the same depth
   * sequence under different prompts, rows = the labels in `rows` (top to bottom).
   * Optional `columns: ["...", ...]` adds a label above each column.
   * ---------------------------------------------------------------------- */
  decomposition: {
    rows: [
      { title: "Re-rendered RGB",            detail: "same depth, different text prompts" },
      { title: "Appearance subspace",        detail: "&Pi;<sub>&#8741;</sub><i>z</i><sub>4d</sub> (16-D)" },
      { title: "Geometry + camera subspace", detail: "&Pi;<sub>&perp;</sub><i>z</i><sub>4d</sub> (16-D)" },
    ],
    examples: [
      { title: "Virtual KITTI 2: driving scene", src: "static/videos/decomposition/vkitti2_4styles.mp4" },
    ],
  },
};
