// TRABAJO FINAL ÓSCAR ALCARRIA LASERNA JS

//-------------------------
//Variables globales
//-------------------------
let renderer, scene, camera;
let controls;
let velocity = new THREE.Vector3();
let direction = new THREE.Vector3();
let keys = {};
let isLocked = false;
let playerModel = null;
let isThirdPerson = false;
let playerLight;
let backgroundMusic;

//almacenar los objetos con colisión
let collidableObjects = [];

//para la entidad enemiga
let enemyEntity = null;
let enemySpeed = 0.30;
let enemyDetectionRange = 150;
let enemyChaseSpeed = 0.35;
let isPlayerCaught = false;
let enemyPathUpdateTimer = 0;
let captureSound;

//animacion
let mixer;
let walkAction;
let idleAction;

//salida del laberinto
let exitPosition = null;


//inicialización
init();
loadBackgroundMusic();
loadScene();
loadPlayerModel();
//esperar 45 segundos antes de generar la entidad enemiga
setTimeout(() => {
    console.log("45 segundos transcurridos. Generando entidad enemiga...");
    loadEnemyEntity();
}, 45000);
render();

function init() {
 
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(new THREE.Color(0x222222));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.getElementById('container').appendChild(renderer.domElement);

    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

    setupControls();

    //event listeners
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    document.addEventListener('click', onClick);
    document.addEventListener('pointerlockchange', onPointerLockChange);
    document.addEventListener('pointerlockerror', onPointerLockError);
    window.addEventListener('resize', onWindowResize);
    document.addEventListener("keydown", (event) => {
    if (event.code === "KeyV") {
        isThirdPerson = !isThirdPerson;
        if (playerModel) playerModel.visible = isThirdPerson;
        console.log("Vista:", isThirdPerson ? "3ª persona" : "1ª persona");
    }
    });

    //para el grito del fantasma
    const listener = new THREE.AudioListener();
    camera.add(listener);

    captureSound = new THREE.Audio(listener);

    const audioLoader = new THREE.AudioLoader();
    audioLoader.load('audio/61033__timtube__scream-3.wav', (buffer) => {
        captureSound.setBuffer(buffer);
        captureSound.setLoop(false);
        captureSound.setVolume(0.8);
    });

}

function setupControls() {
    //controles FPS
    const euler = new THREE.Euler(0, 0, 0, 'YXZ');
    const PI_2 = Math.PI / 2;

    document.addEventListener('mousemove', (event) => {
        if (!isLocked) return;

        const movementX = event.movementX || event.mozMovementX || event.webkitMovementX || 0;
        const movementY = event.movementY || event.mozMovementY || event.webkitMovementY || 0;

        euler.setFromQuaternion(camera.quaternion);
        euler.y -= movementX * 0.002;
        euler.x -= movementY * 0.002;
        euler.x = Math.max(PI_2 - Math.PI, Math.min(PI_2, euler.x));

        camera.quaternion.setFromEuler(euler);
    });
}

//-------------------------
// loadScene()
//-------------------------
function loadScene() {
    //niebla densa
    scene.fog = new THREE.FogExp2(0x0a0a05, 0.015);

    //luz amarilla
    const ambientLight = new THREE.AmbientLight(0xfff2cc, 0.25);
    scene.add(ambientLight);

    //luz del jugador
    playerLight = new THREE.PointLight(0xffdd66, 2, 80, 2);
    playerLight.castShadow = true;

    //añadir luz a 1a o 3a persona
    camera.add(playerLight);


    scene.add(camera);

    //textura del piso
    const textureLoader = new THREE.TextureLoader();
    const groundTexture = textureLoader.load('images/suelo-backrooms.png');
    groundTexture.wrapS = THREE.RepeatWrapping;
    groundTexture.wrapT = THREE.RepeatWrapping;
    groundTexture.repeat.set(10, 10);

    const groundMaterial = new THREE.MeshLambertMaterial({
        map: groundTexture,
        color: 0x555533 //oscuro
    });

    //textura para paredes
    const wallMaterial = new THREE.MeshLambertMaterial({
        color: 0x666644,
        side: THREE.DoubleSide
    });

    const spawnPosition = createMazeLevel(groundMaterial);
    camera.position.set(spawnPosition.x, 10, spawnPosition.z);
    console.log(`Jugador spawneado en (${spawnPosition.x}, 10, ${spawnPosition.z})`);
}


//-------------------------
// SECCIÓN 1: GENERACIÓN DEL LABERINTO
//-------------------------

//generar laberinto usando algoritmo DFS con backtracking
function generateDFSBacktrackingMaze(width, height) {
    //grid sin duplicar dim
    let maze = Array.from({ length: width }, () => Array(height).fill(1));
    
    //stack para el algoritmo DFS
    const stack = [];
    const visited = Array.from({ length: width }, () => Array(height).fill(false));
    
    //direcciones
    const directions = [
        [-1, 0],//arriba
        [0, 1], //derecha  
        [1, 0], //abajo
        [0, -1] //izquierda
    ];
    
    //mezclar direcciones aleatoriamente
    function shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }
    
    //obtener vecinos no visitados
    function getUnvisitedNeighbors(x, y) {
        const neighbors = [];
        const shuffledDirections = shuffleArray(directions);
        
        for (const [dx, dy] of shuffledDirections) {
            const newX = x + dx * 2;
            const newY = y + dy * 2;
            
            if (newX >= 0 && newX < width && 
                newY >= 0 && newY < height && 
                !visited[newX][newY]) {
                neighbors.push([newX, newY]);
            }
        }
        return neighbors;
    }
    
    //crear camino entre dos celdas
    function createPath(x1, y1, x2, y2) {
        maze[x1][y1] = 0;
        maze[x2][y2] = 0;
        
        const wallX = (x1 + x2) / 2;
        const wallY = (y1 + y2) / 2;
        maze[wallX][wallY] = 0;
    }
    
    const startX = 1;
    const startY = 1;
    
    visited[startX][startY] = true;
    stack.push([startX, startY]);
    maze[startX][startY] = 0;
    
    //algoritmo DFS con backtracking
    while (stack.length > 0) {
        const [currentX, currentY] = stack[stack.length - 1];
        const neighbors = getUnvisitedNeighbors(currentX, currentY);
        
        if (neighbors.length > 0) {
            const [nextX, nextY] = neighbors[0];
            visited[nextX][nextY] = true;
            createPath(currentX, currentY, nextX, nextY);
            stack.push([nextX, nextY]);
        } else {
            stack.pop();
        }
    }
    
    maze[1][1] = 0;
    maze[width - 2][height - 2] = 0;
    
    if (width > 2 && height > 2) {
        //maze[0][1] = 0;
        maze[width - 1][height - 2] = 0;
    }
    
    return maze;
}

//crear laberinto
function createMazeLevel(groundMaterial) {
    const mazeWidth = 21;
    const mazeHeight = 21;
    const wallHeight = 18;
    const cellSize = 20;
    const ceilingHeight = wallHeight;
    
    //generar laberinto con alg. corregido
    const maze = generateDFSBacktrackingMaze(mazeWidth, mazeHeight);
    
    //cargar texturas
    const textureLoader = new THREE.TextureLoader();
    const wallTexture = textureLoader.load('images/pared-backrooms.png');
    wallTexture.wrapS = THREE.RepeatWrapping;
    wallTexture.wrapT = THREE.RepeatWrapping;
    wallTexture.repeat.set(1, 1);
    
    const ceilingTexture = textureLoader.load('images/techo-backrooms.png');
    ceilingTexture.wrapS = THREE.RepeatWrapping;
    ceilingTexture.wrapT = THREE.RepeatWrapping;
    ceilingTexture.repeat.set(2, 2);
    
    const wallMaterial = new THREE.MeshLambertMaterial({ map: wallTexture });
    const ceilingMaterial = new THREE.MeshLambertMaterial({ map: ceilingTexture });
    
    //posicion de spawn
    let spawnPosition = null;
    
    for (let x = 0; x < maze.length; x++) {
        for (let z = 0; z < maze[0].length; z++) {
            const posX = (x - maze.length / 2) * cellSize;
            const posZ = (z - maze[0].length / 2) * cellSize;
            
            //piso
            const floor = new THREE.Mesh(
                new THREE.PlaneGeometry(cellSize, cellSize),
                groundMaterial
            );
            floor.rotation.x = -Math.PI / 2;
            floor.position.set(posX, 0, posZ);
            floor.receiveShadow = true;
            scene.add(floor);

            //techo
            const ceiling = new THREE.Mesh(
                new THREE.PlaneGeometry(cellSize, cellSize),
                ceilingMaterial
            );
            ceiling.rotation.x = Math.PI / 2; //mirar hacia abajo
            ceiling.position.set(posX, ceilingHeight, posZ);
            ceiling.receiveShadow = true;
            scene.add(ceiling);
            
            //paredes
            if (maze[x][z] === 1) {
                createSingleWall(posX, posZ, wallMaterial, wallHeight, cellSize);
            } else {
                if (!spawnPosition) {
                    spawnPosition = { x: posX, z: posZ };
                }
            }
        }
    }
    
    //entrada y salida
    const entranceX = (1 - maze.length / 2) * cellSize;
    const entranceZ = (1 - maze[0].length / 2) * cellSize;
    createEntrance(entranceX, entranceZ);
    
    const exitX = (maze.length - 2 - maze.length / 2) * cellSize;
    const exitZ = (maze[0].length - 2 - maze[0].length / 2) * cellSize;
    createAdvancedExit(exitX, exitZ);
    
    console.log(`Laberinto con pasillos anchos generado: ${maze.length}x${maze[0].length}`);
    console.log(`Objetos colisionables: ${collidableObjects.length}`);
    
    return spawnPosition || { x: entranceX, z: entranceZ };
}

//crea pared por celda
function createSingleWall(x, z, material, height, cellSize) {
    const wallGeometry = new THREE.BoxGeometry(cellSize, height, cellSize);
    const wall = new THREE.Mesh(wallGeometry, material);
    wall.position.set(x, height / 2, z);
    wall.castShadow = true;
    wall.receiveShadow = true;
    scene.add(wall);
    
    //agregar la pared al array de objetos colisionables
    collidableObjects.push(wall);
    
    for (let i = 0; i < 4; i++) {
        const Stalk = new THREE.Mesh(
            new THREE.CylinderGeometry(0.3, 0.4, height * 0.08),
            material
        );
        Stalk.position.set(
            x + (Math.random() - 0.5) * cellSize * 0.4,
            height + Math.random() * 2,
            z + (Math.random() - 0.5) * cellSize * 0.4
        );
        Stalk.castShadow = true;
        scene.add(Stalk);
    }
}

//crear entrada visible
function createEntrance(x, z) {
    const entranceGeometry = new THREE.CylinderGeometry(6, 6, 1, 32);
    const entranceMaterial = new THREE.MeshLambertMaterial({ 
        color: 0x00ff00,
        emissive: 0x002200
    });
    const entrance = new THREE.Mesh(entranceGeometry, entranceMaterial);
    entrance.position.set(x, 0.5, z);
    scene.add(entrance);
    
    const entranceLight = new THREE.PointLight(0x00ff00, 1.2, 50);
    entranceLight.position.set(x, 8, z);
    scene.add(entranceLight);
    
    console.log(`Entrada amplia creada en posición: (${x}, ${z})`);
}

//crear la salida del laberinto
function createAdvancedExit(x, z) {
    const exitBase = new THREE.Mesh(
        new THREE.CylinderGeometry(8, 8, 1, 32),
        new THREE.MeshLambertMaterial({ color: 0x8B4513 })
    );
    exitBase.position.set(x, 0.5, z);
    scene.add(exitBase);
    
    const flagPole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.2, 20),
        new THREE.MeshLambertMaterial({ color: 0x654321 })
    );
    flagPole.position.set(x, 10, z);
    scene.add(flagPole);
    
    const flag = new THREE.Mesh(
        new THREE.PlaneGeometry(10, 6),
        new THREE.MeshLambertMaterial({ 
            color: 0xff0000,
            side: THREE.DoubleSide
        })
    );
    flag.position.set(x + 5, 16, z);
    scene.add(flag);
    
    const exitLight = new THREE.PointLight(0xff0000, 1.5, 80);
    exitLight.position.set(x, 15, z);
    scene.add(exitLight);
    
    //guardar posicion de salida
    exitPosition = new THREE.Vector3(x, 10, z); //10 por la altura del jugador
    
    console.log(`Salida amplia creada en posición: (${x}, ${z})`);
}

//-------------------------

//-------------------------
// SECCIÓN 2: DETECCIÓN DE COLISIONES
//-------------------------

//detectar colisiones usando raycasting
function checkCollision(newPosition) {
    const playerRadius = 2; //radio de colisión del jugador
    const rayDistance = playerRadius + 1; //distancia de detección
    
    //crear raycaster desde la posición del jugador
    const raycaster = new THREE.Raycaster();
    
    //direcciones a verificar (8 direcciones + arriba y abajo)
    const directions = [
        new THREE.Vector3(1, 0, 0),
        new THREE.Vector3(-1, 0, 0),
        new THREE.Vector3(0, 0, 1),
        new THREE.Vector3(0, 0, -1),
        new THREE.Vector3(1, 0, 1).normalize(),
        new THREE.Vector3(1, 0, -1).normalize(),
        new THREE.Vector3(-1, 0, 1).normalize(),
        new THREE.Vector3(-1, 0, -1).normalize(),
    ];
    
    //verificar colisiones en todas las direc
    for (let direction of directions) {
        raycaster.set(newPosition, direction);
        const intersections = raycaster.intersectObjects(collidableObjects);
        
        if (intersections.length > 0 && intersections[0].distance < rayDistance) {
            return true;
        }
    }
    
    return false;
}

function onKeyDown(event) {
    keys[event.code] = true;
}

function onKeyUp(event) {
    keys[event.code] = false;
}

function onClick() {
    if (!isLocked) {
        document.body.requestPointerLock();
        document.getElementById('instructions').classList.add('hidden');
    }
}

function onPointerLockChange() {
    isLocked = document.pointerLockElement === document.body;
    if (!isLocked) {
        document.getElementById('instructions').classList.remove('hidden');
    }
}

function onPointerLockError() {
    console.error('Pointer lock failed');
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

//-------------------------

//-------------------------
//SECCIÓN 3:CARGAR EL MODELO DEL JUGADOR 
//-------------------------

//cargar el modelo animado (Idle)
function loadPlayerModel() {
    console.log(" Cargando modelo animado Hazmat...");

    const loader = new THREE.FBXLoader();
    loader.load('animations/HazmatSuitPose@Idle.fbx', (fbx) => {
        playerModel = fbx;
        playerModel.scale.set(5.5, 5.5, 5.5);
        playerModel.position.set(camera.position.x, 0, camera.position.z);
        playerModel.visible = false;

        //texturas
        const textureLoader = new THREE.TextureLoader();
        const texAlbedo   = textureLoader.load('models/hazman_suit/textures/Hazmat_albedo.jpg');
        const texAO       = textureLoader.load('models/hazman_suit/textures/Hazmat_AO.jpg');
        const texNormal   = textureLoader.load('models/hazman_suit/textures/Hazmat_normal.png');
        const texRoughness = textureLoader.load('models/hazman_suit/textures/Hazmat_roughness.jpg');

        //material pbr
        const hazmatMaterial = new THREE.MeshStandardMaterial({
            map: texAlbedo,
            aoMap: texAO,
            normalMap: texNormal,
            roughnessMap: texRoughness,
            metalness: 0.1,
            roughness: 1.0,
        });

        //aplicar material por submesh
        playerModel.traverse((child) => {
            if (child.isMesh) {
                child.material = hazmatMaterial;
                child.castShadow = true;
                child.receiveShadow = true;

                if (child.geometry.attributes.uv2 === undefined && child.geometry.attributes.uv) {
                    child.geometry.setAttribute('uv2', child.geometry.attributes.uv);
                }
            }
        });

        console.log(" Texturas Hazmat aplicadas correctamente");

        //mixer
        mixer = new THREE.AnimationMixer(playerModel);

        //accion de idle
        idleAction = mixer.clipAction(fbx.animations[0]);
        idleAction.play();

        scene.add(playerModel);
        console.log("✅ Modelo Idle cargado");

        //cargar la de andar
        loadPlayerAnimation();
    });
}

//cargar animación de caminar
function loadPlayerAnimation() {
    const fbxLoader = new THREE.FBXLoader();
    fbxLoader.load('animations/HazmatSuitPose@Walking.fbx', (fbx) => {
        walkAction = mixer.clipAction(fbx.animations[0]);
        walkAction.loop = THREE.LoopRepeat;
        walkAction.enabled = true;
        console.log("✅ Animación Walking cargada");
    });
}


//-------------------------

//-------------------------
// SECCIÓN 4: ENTIDAD ENEMIGA
//-------------------------

//cargar la entidad enemiga desde un archivo GLTF
function loadEnemyEntity() {
    console.log("Cargando entidad enemiga...");

    const loader = new THREE.GLTFLoader();

    
    loader.load(
    'models/ghost_in_a_white_sheet/scene.gltf',
    (gltf) => {
        enemyEntity = gltf.scene;
        enemyEntity.scale.set(10, 10, 10);
        enemyEntity.position.set(Math.random() * 200 - 100, 15, Math.random() * 200 - 100);

        enemyEntity.traverse((child) => {
            if (child.isMesh) {
                child.material.side = THREE.DoubleSide;
                child.material.needsUpdate = true;
            }
        });

        const enemyLight = new THREE.PointLight(0xff0000, 2, 30);
        enemyLight.position.y = 8;
        enemyEntity.add(enemyLight);

        scene.add(enemyEntity);
        console.log("✅ Entidad enemiga cargada");
    },
    undefined,
    (error) => console.error('Error al cargar el modelo:', error)
);
}

//actualizar la IA del enemigo con raycasting
function updateEnemyAI() {
    if (!enemyEntity || isPlayerCaught) return;
    
    const playerPos = camera.position.clone();
    const enemyPos = enemyEntity.position.clone();

    //calcular distancia al jugador
    const distanceToPlayer = playerPos.distanceTo(enemyPos);

    //hacer que el enemigo mire hacia el jugador
    const lookTarget = new THREE.Vector3(playerPos.x, enemyEntity.position.y, playerPos.z);
    enemyEntity.lookAt(lookTarget);

    //velocidad según distancia (+cerca +velocidad)
    let currentSpeed = enemySpeed;
    const light = enemyEntity.children.find(child => child instanceof THREE.PointLight);
    
    if (distanceToPlayer < enemyDetectionRange) {
        currentSpeed = enemyChaseSpeed;
        if (light) {
            light.intensity = 3;
            light.distance = 50;
        }
    } else {
        if (light) {
            light.intensity = 2;
            light.distance = 30;
        }
    }

    //dirección hacia el jugador
    const direction = new THREE.Vector3();
    direction.subVectors(playerPos, enemyPos);
    direction.y = 0;
    direction.normalize();

    //raycasting para colisoin
    const raycaster = new THREE.Raycaster();
    const directionVector = direction.clone().multiplyScalar(1); //direc hacia el jugador
    raycaster.set(enemyPos, directionVector);

    //detectar col
    const intersections = raycaster.intersectObjects(scene.children, true);
    
    let isBlocked = intersections.length > 0 && intersections[0].distance < currentSpeed;
    
    //si colision se intenta escapar
    if (isBlocked) {
        const sideStep = new THREE.Vector3(direction.z, 0, -direction.x).multiplyScalar(currentSpeed);

        // hacia la izquierda
        const tryLeft = enemyPos.clone().add(sideStep);
        const tryRight = enemyPos.clone().sub(sideStep);

        //ver si laterales libres
        const leftRay = new THREE.Raycaster();
        leftRay.set(tryLeft, directionVector);
        const rightRay = new THREE.Raycaster();
        rightRay.set(tryRight, directionVector);

        const leftIntersections = leftRay.intersectObjects(scene.children, true);
        const rightIntersections = rightRay.intersectObjects(scene.children, true);

        //si la izquierda está libre, mover hacia la izquierda
        if (leftIntersections.length === 0) {
            enemyEntity.position.copy(tryLeft);
        } 
        //si la derecha está libre, mover hacia la derecha
        else if (rightIntersections.length === 0) {
            enemyEntity.position.copy(tryRight);
        } 
        //si no hay movimiento lateral, mover hacia atrás para evitar quedarse atrapado
        else {
            const reverseStep = new THREE.Vector3(-direction.x, 0, -direction.z).multiplyScalar(currentSpeed);
            enemyEntity.position.add(reverseStep);
        }
    } else {
        //si no hay pared, el enemigo sigue moviéndose normalmente hacia el jugador
        enemyEntity.position.addScaledVector(direction, currentSpeed);
    }

    //flotar
    enemyEntity.position.y = Math.sin(Date.now() * 0.002) * 0.5;

    //colision con jugador
    const playerCollider = new THREE.Box3().setFromCenterAndSize(
        new THREE.Vector3(camera.position.x, camera.position.y, camera.position.z),
        new THREE.Vector3(2, 6, 2) //hitbox del jugador
    );

    const enemyCollider = new THREE.Box3().setFromObject(enemyEntity);

    if (playerCollider.intersectsBox(enemyCollider)) {
        playerCaught();
    }
}

//jugador es atrapado
function playerCaught() {
    if (isPlayerCaught) return;
    
    isPlayerCaught = true;
    console.log("¡Has sido atrapado!");
    
    if (captureSound && !captureSound.isPlaying) {
        captureSound.play();
    }
    //game over en html
    const gameOverDiv = document.createElement('div');
    gameOverDiv.id = 'gameOver';
    gameOverDiv.innerHTML = `
        <h1 style="color: #ff0000; font-size: 72px; text-shadow: 0 0 20px #ff0000;">
            TE ATRAPÓ
        </h1>
        <p style="font-size: 24px; margin-top: 20px;">
            Presiona F5 para reintentar
        </p>
    `;
    gameOverDiv.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.95);
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        z-index: 1000;
        font-family: Arial, sans-serif;
        color: white;
        text-align: center;
    `;
    document.body.appendChild(gameOverDiv);
    
    //liberar el pointer lock
    document.exitPointerLock();
}
//función cuando escapa el jugador
function playerEscaped() {
    console.log("¡Has escapado con éxito!");
    document.exitPointerLock();

    const winDiv = document.createElement('div');
    winDiv.id = 'winScreen';
    winDiv.innerHTML = `
        <h1 style="color: #00ff88; font-size: 72px; text-shadow: 0 0 20px #00ff88;">
            ¡Has escapado con éxito!
        </h1>
        <p style="font-size: 28px; margin-top: 20px;">
            ¡Misión cumplida!
        </p>
        <p style="font-size: 22px; margin-top: 40px;">
            Presiona F5 para jugar de nuevo
        </p>
    `;
    winDiv.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.95);
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        z-index: 2000;
        font-family: Arial, sans-serif;
        color: white;
        text-align: center;
    `;
    document.body.appendChild(winDiv);

    //detener música si está sonando
    if (backgroundMusic && backgroundMusic.isPlaying) {
        backgroundMusic.stop();
    }

    //evitar más actualizaciones
    isPlayerCaught = true;
}


//-------------------------

//-------------------------
// SECCIÓN 5: SONIDO
//-------------------------

//música de fondo
function loadBackgroundMusic() {
    const listener = new THREE.AudioListener();
    camera.add(listener); //listener va con la cámara

    backgroundMusic = new THREE.Audio(listener);

    const audioLoader = new THREE.AudioLoader();
    audioLoader.load('audio/326984__zetauri__zetauri_darkambienceloop_1496110c.wav', (buffer) => {
        backgroundMusic.setBuffer(buffer);
        backgroundMusic.setLoop(true);
        backgroundMusic.setVolume(0.3);
        backgroundMusic.play();
        console.log("Música iniciada");
    });
}

//grito al atraparte



//-------------------------

//-------------------------
// update
//-------------------------

function update() {
    if (!isLocked) return;

    const speed = 0.3;

    //sprint al mantener Shift
    const isRunning = keys['ShiftLeft'] || keys['ShiftRight'];
    const finalSpeed = isRunning ? speed * 2 : speed;
    
    //determinar la posición actual del jugador
    let playerPosition;
    
    if (isThirdPerson && playerModel) {
        playerPosition = new THREE.Vector3(playerModel.position.x, 10, playerModel.position.z);
    } else {
        playerPosition = camera.position.clone();
    }
    
    //calcular vectores de movimiento basados en la orientación de la cámara
    const forward = new THREE.Vector3(0, 0, -1);
    const right = new THREE.Vector3(1, 0, 0);
    
    forward.applyQuaternion(camera.quaternion);
    right.applyQuaternion(camera.quaternion);
    
    //proyectar al plano horizontal
    forward.y = 0;
    right.y = 0;
    forward.normalize();
    right.normalize();

    //calcular nueva posición
    let newPosition = playerPosition.clone();
    let isMoving = false;
    
    if (keys['KeyW']) {
        newPosition.addScaledVector(forward, finalSpeed);
        isMoving = true;
    }
    if (keys['KeyS']) {
        newPosition.addScaledVector(forward, -finalSpeed);
        isMoving = true;
    }
    if (keys['KeyA']) {
        newPosition.addScaledVector(right, -speed);
        isMoving = true;
    }
    if (keys['KeyD']) {
        newPosition.addScaledVector(right, speed);
        isMoving = true;
    }

    newPosition.y = 10;

    if (mixer) {
        mixer.update(0.016);

        if (walkAction && idleAction) {
            if (isMoving && !walkAction.isRunning()) {
                idleAction.fadeOut(0.2);
                walkAction.reset().fadeIn(0.2).play();
            } else if (!isMoving && !idleAction.isRunning()) {
                walkAction.fadeOut(0.2);
                idleAction.reset().fadeIn(0.2).play();
            }
        }
    }
    
    //verificar colisiones
    if (!checkCollision(newPosition)) {
        playerPosition.copy(newPosition);
    } else {
        let slidePosition = playerPosition.clone();
        
        slidePosition.x = newPosition.x;
        slidePosition.y = 10;
        if (!checkCollision(slidePosition)) {
            playerPosition.copy(slidePosition);
        } else {
            slidePosition = playerPosition.clone();
            slidePosition.z = newPosition.z;
            slidePosition.y = 10;
            if (!checkCollision(slidePosition)) {
                playerPosition.copy(slidePosition);
            }
        }
    }

    //actualizar cámara y modelo
    if (playerModel) {
        if (isThirdPerson) {
            //3a pers.
            playerModel.visible = true;
            playerModel.position.set(playerPosition.x, 0, playerPosition.z);

            //el modelo mira hacia donde se mueve
            if (isMoving) {
                const moveDirection = new THREE.Vector3();
                camera.getWorldDirection(moveDirection);
                moveDirection.y = 0;
                moveDirection.normalize();

                const targetQuat = new THREE.Quaternion().setFromUnitVectors(
                    new THREE.Vector3(0, 0, 1),
                    moveDirection
                );

                //giro hacia direc camara
                playerModel.quaternion.slerp(targetQuat, 0.2);

                //ultima orientacion se guarda
                playerModel.lastRotation = new THREE.Euler().copy(playerModel.rotation);
            } else {
                //orientacion se mantiene al estar quieto
                if (playerModel.lastRotation) {
                    playerModel.rotation.copy(playerModel.lastRotation);
                }
            }

            const cameraDistance = 30;
            const cameraHeight = 6;
            
            //direc de la camara
            const cameraDirection = new THREE.Vector3();
            camera.getWorldDirection(cameraDirection);
            cameraDirection.y = 0;
            cameraDirection.normalize();
            
            //posición objetivo de la cámara
            const targetCameraPos = playerPosition.clone();
            targetCameraPos.addScaledVector(cameraDirection, -cameraDistance);
            targetCameraPos.y = playerPosition.y + cameraHeight;
            
            camera.position.copy(targetCameraPos);
            
            //mirar al jugador
            const lookTarget = new THREE.Vector3(
                playerPosition.x, 
                playerPosition.y + 5, 
                playerPosition.z
            );
            camera.lookAt(lookTarget);

        } else {
            //1a pers.
            playerModel.visible = false;
            camera.position.copy(playerPosition);
            
            playerModel.position.set(playerPosition.x, 0, playerPosition.z);
            
            const camDir = new THREE.Vector3();
            camera.getWorldDirection(camDir);
            camDir.y = 0;
            camDir.normalize();
            playerModel.lookAt(playerModel.position.clone().add(camDir));
        }
    } else {
        camera.position.copy(playerPosition);
    }


    if (exitPosition && !isPlayerCaught) {
        const distanceToExit = camera.position.distanceTo(exitPosition);
        if (distanceToExit < 10) { //radio de detección de victoria
            playerEscaped();
        }
    }
}
function render() {
    requestAnimationFrame(render);
    update();
    updateEnemyAI();
    


    renderer.render(scene, camera);
}


//-------------------------
// SECCION 6: PANTALLA DE INICIO
//-------------------------
window.addEventListener("DOMContentLoaded", () => {
    const startScreen = document.getElementById("startScreen");
    const playButton = document.getElementById("playButton");

    playButton.addEventListener("click", () => {
        startScreen.style.display = "none";
        document.body.requestPointerLock();
        loadBackgroundMusic(); //empieza musica
    });
});



//-------------------------