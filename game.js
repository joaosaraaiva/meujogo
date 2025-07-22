window.onload = function() {
    // --- CONFIGURAÇÃO E RESIZE (sem alterações) ---
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const WORLD_WIDTH = 1920; const WORLD_HEIGHT = 1080; const GAME_ASPECT_RATIO = WORLD_WIDTH / WORLD_HEIGHT;
    function resizeCanvas() {
        const screenWidth = window.innerWidth, screenHeight = window.innerHeight;
        const screenAspectRatio = screenWidth / screenHeight;
        let newWidth, newHeight;
        if (screenAspectRatio > GAME_ASPECT_RATIO) { newHeight = screenHeight; newWidth = newHeight * GAME_ASPECT_RATIO; } 
        else { newWidth = screenWidth; newHeight = newWidth / GAME_ASPECT_RATIO; }
        canvas.width = newWidth; canvas.height = newHeight;
        canvas.style.width = `${newWidth}px`; canvas.style.height = `${newHeight}px`;
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    // --- CARREGAMENTO DE IMAGENS (sem alterações) ---
    const playerImage = new Image(); playerImage.src = 'personagem.png';
    const mapImage = new Image(); mapImage.src = 'mapa.png';
    let imagesLoaded = 0; const totalImages = 2;
    function onImageLoad() {
        imagesLoaded++;
        if (imagesLoaded === totalImages) {
            lastTime = performance.now();
            requestAnimationFrame(gameLoop);
        }
    }
    playerImage.onload = onImageLoad; mapImage.onload = onImageLoad;

    // --- ESTADO DO JOGO ---
    const camera = { x: 0, y: 0, lerpFactor: 0.08 };
    const NORMAL_SPEED = 3.2, SHOOTING_SPEED = 0.8, DASH_SPEED = 18;
    const DASH_DURATION = 0.15, DASH_COOLDOWN = 1.0;
    const player = { x: WORLD_WIDTH / 4, y: WORLD_HEIGHT / 2, width: 45, height: 45, rotation: 0, isShooting: false, isDashing: false, dashTimer: 0, dashCooldownTimer: 0 };
    const bullets = []; const controls = { joystick: { x: 0, y: 0, active: false }, shoot: { active: false }, dash: { pressed: false } };
    let lastTime = 0, shootInterval;

    // NOVO: ID para rastrear o toque específico do joystick
    let joystickTouchId = null;

    // --- LÓGICA DE DESENHO (sem alterações) ---
    function draw() {
        ctx.save();
        ctx.translate(-camera.x, -camera.y);
        ctx.drawImage(mapImage, 0, 0, WORLD_WIDTH, WORLD_HEIGHT);

        bullets.forEach(bullet => { ctx.fillStyle = 'orange'; ctx.save(); ctx.translate(bullet.x, bullet.y); ctx.rotate(bullet.rotation); ctx.fillRect(0, -2, 15, 4); ctx.restore(); });
        ctx.save(); ctx.translate(player.x, player.y); ctx.rotate(player.rotation); ctx.drawImage(playerImage, -player.width / 2, -player.height / 2, player.width, player.height); ctx.restore();

        ctx.restore();
    }

    // --- LÓGICA DE ATUALIZAÇÃO (com a lógica de controle corrigida) ---
    function update(deltaTime) {
        if (player.dashTimer > 0) player.dashTimer -= deltaTime;
        if (player.dashCooldownTimer > 0) player.dashCooldownTimer -= deltaTime;
        if (player.isDashing && player.dashTimer <= 0) player.isDashing = false;
        if (controls.dash.pressed && !player.isDashing && player.dashCooldownTimer <= 0) { player.isDashing = true; player.dashTimer = DASH_DURATION; player.dashCooldownTimer = DASH_COOLDOWN; }
        controls.dash.pressed = false;
        
        // MUDANÇA: A rotação é atualizada sempre que o joystick está ativo,
        // permitindo que você mire enquanto está no meio de um dash.
        if (controls.joystick.active) {
            player.rotation = Math.atan2(controls.joystick.y, controls.joystick.x);
        }
        
        let currentSpeed = 0;
        if (player.isDashing) {
            currentSpeed = DASH_SPEED;
        } else if (controls.joystick.active) { // Se não está no dash, o movimento normal depende do joystick
            currentSpeed = controls.shoot.active ? SHOOTING_SPEED : NORMAL_SPEED;
        }

        if (currentSpeed > 0) {
            const moveSpeed = currentSpeed * 60 * deltaTime;
            player.x += Math.cos(player.rotation) * moveSpeed;
            player.y += Math.sin(player.rotation) * moveSpeed;
        }

        player.x = Math.max(player.width / 2, Math.min(WORLD_WIDTH - player.width / 2, player.x));
        player.y = Math.max(player.height / 2, Math.min(WORLD_HEIGHT - player.height / 2, player.y));
        
        for (let i = bullets.length - 1; i >= 0; i--) { const b = bullets[i]; const s = 1000 * deltaTime; b.x += Math.cos(b.rotation) * s; b.y += Math.sin(b.rotation) * s; if (b.x < 0 || b.x > WORLD_WIDTH || b.y < 0 || b.y > WORLD_HEIGHT) bullets.splice(i, 1); }
        
        const targetCamX = player.x - canvas.width / 2, targetCamY = player.y - canvas.height / 2;
        camera.x += (targetCamX - camera.x) * camera.lerpFactor; camera.y += (targetCamY - camera.y) * camera.lerpFactor;
        camera.x = Math.max(0, Math.min(camera.x, WORLD_WIDTH - canvas.width));
        camera.y = Math.max(0, Math.min(camera.y, WORLD_HEIGHT - canvas.height));
    }

    function gameLoop(currentTime) { const dt = (currentTime - lastTime) / 1000; lastTime = currentTime; update(dt); draw(); requestAnimationFrame(gameLoop); }
    function fireBullet() { bullets.push({ x: player.x + Math.cos(player.rotation) * (player.width / 2), y: player.y + Math.sin(player.rotation) * (player.width / 2), rotation: player.rotation }); }
    
    // --- CONTROLES - GRANDES MUDANÇAS AQUI PARA MULTITOUCH ROBUSTO ---

    const joystickBase = document.getElementById('joystick-base');
    const joystickHandle = document.getElementById('joystick-handle');
    const shootButton = document.getElementById('shoot-button');
    const dashButton = document.getElementById('dash-button');
    
    function handleJoystickStart(touch) {
        joystickTouchId = touch.identifier; // Guarda o ID do dedo que está no joystick
        controls.joystick.active = true;
    }

    function handleJoystickMove(touch) {
        const rect = joystickBase.getBoundingClientRect();
        const joystickX = touch.clientX - rect.left - rect.width / 2;
        const joystickY = touch.clientY - rect.top - rect.height / 2;
        
        const distance = Math.sqrt(joystickX * joystickX + joystickY * joystickY);
        const maxDist = rect.width / 2 - 20;
        
        let finalX, finalY;
        if (distance > maxDist) {
            finalX = (joystickX / distance) * maxDist;
            finalY = (joystickY / distance) * maxDist;
        } else {
            finalX = joystickX;
            finalY = joystickY;
        }
        
        controls.joystick.x = finalX;
        controls.joystick.y = finalY;
        joystickHandle.style.transform = `translate(${finalX}px, ${finalY}px)`;
    }

    function handleJoystickEnd() {
        joystickTouchId = null; // Libera o ID
        controls.joystick.active = false;
        joystickHandle.style.transform = `translate(0px, 0px)`;
    }

    // Ouvintes de evento (event listeners) agora tratam múltiplos toques
    
    window.addEventListener('touchstart', (e) => {
        e.preventDefault();
        for (const touch of e.changedTouches) {
            // Verifica se o toque foi DENTRO da base do joystick
            const rect = joystickBase.getBoundingClientRect();
            if (touch.clientX >= rect.left && touch.clientX <= rect.right &&
                touch.clientY >= rect.top && touch.clientY <= rect.bottom) {
                if (joystickTouchId === null) { // Pega o primeiro dedo que tocar ali
                    handleJoystickStart(touch);
                    handleJoystickMove(touch);
                }
            }
        }
    }, { passive: false });

    window.addEventListener('touchmove', (e) => {
        e.preventDefault();
        if (joystickTouchId !== null) { // Só processa o movimento se um dedo está no joystick
            for (const touch of e.changedTouches) {
                if (touch.identifier === joystickTouchId) {
                    handleJoystickMove(touch);
                    break; // Achou o dedo certo, pode parar o loop
                }
            }
        }
    }, { passive: false });

    window.addEventListener('touchend', (e) => {
        e.preventDefault();
        if (joystickTouchId !== null) {
            for (const touch of e.changedTouches) {
                if (touch.identifier === joystickTouchId) { // Só finaliza se o DEDO CERTO foi solto
                    handleJoystickEnd();
                    break;
                }
            }
        }
    });

    // Controles com mouse (para teste no PC) continuam simples
    function handleMouseJoystick(e) { e.preventDefault(); handleJoystickMove(e); }
    joystickBase.addEventListener('mousedown', e => {
        controls.joystick.active = true;
        handleMouseJoystick(e);
        window.addEventListener('mousemove', handleMouseJoystick, { passive: false });
    });
    window.addEventListener('mouseup', () => {
        controls.joystick.active = false;
        joystickHandle.style.transform = 'translate(0px, 0px)';
        window.removeEventListener('mousemove', handleMouseJoystick);
    });
    
    // Funções e ouvintes dos botões de ação (praticamente iguais)
    function handleShootStart(e) { e.preventDefault(); controls.shoot.active = true; fireBullet(); shootInterval = setInterval(fireBullet, 150); }
    function handleShootEnd(e) { e.preventDefault(); controls.shoot.active = false; clearInterval(shootInterval); }
    function handleDash(e) { e.preventDefault(); controls.dash.pressed = true; }
    
    shootButton.addEventListener('touchstart', handleShootStart, { passive: false });
    shootButton.addEventListener('touchend', handleShootEnd);
    shootButton.addEventListener('mousedown', handleShootStart);
    shootButton.addEventListener('mouseup', handleShootEnd);

    dashButton.addEventListener('touchstart', handleDash, { passive: false });
    dashButton.addEventListener('mousedown', handleDash);
};