document.addEventListener('DOMContentLoaded', function() {
    const introScreen = document.getElementById('intro-screen');
    const gameContainer = document.getElementById('game-container');
    const playBtn = document.getElementById('play-btn');
    const restartBtn = document.getElementById('restart-btn');
    const gameOverScreen = document.getElementById('game-over');
    const scoreDisplay = document.getElementById('score-display');
    const finalScoreDisplay = document.getElementById('final-score');
    const canvas = document.getElementById('game-canvas');
    const ctx = canvas.getContext('2d');

    // Set canvas dimensions
    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    // Game variables
    let gameActive = false;
    let score = 0;
    let player;
    let enemies = [];
    let bullets = [];
    let enemyBullets = [];
    let particles = [];
    let keys = {};
    let lastEnemySpawn = 0;
    let animationId;
    let playerHealth = 100;
    let gameStartTime = 0;
    let gameTimer = 0;
// All emojis can spawn as enemies
    const allEmojis = Array.from({length: 5000}, (_, i) => String.fromCodePoint(0x1F600 + i)).filter(emoji => {
        try {
            return /\p{Emoji}/u.test(emoji);
        } catch {
            return false;
        }
    }).slice(0, 1000); // Limit to 1000 emojis for performance
    // Player class
    class Player {
        constructor() {
            this.width = 60;
            this.height = 80;
            this.x = canvas.width / 2 - this.width / 2;
            this.y = canvas.height - this.height - 30;
            this.speed = 8;
            this.lastShot = 0;
            this.shotDelay = 300; // ms between shots
        }
        draw() {
            ctx.save();
            ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
            ctx.rotate(-45 * Math.PI / 180);
            ctx.font = '60px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('🚀', 0, 0);
            ctx.restore();
        }
        update() {
            if (keys['ArrowLeft'] || keys['KeyA'] || keys['a']) {
                this.x = Math.max(0, this.x - this.speed);
            }
            if (keys['ArrowRight'] || keys['KeyD'] || keys['d']) {
                this.x = Math.min(canvas.width - this.width, this.x + this.speed);
            }

            // Shooting with spacebar or left mouse
            const now = Date.now();
            if ((keys[' '] || keys['Spacebar'] || keys['Mouse0']) && now - this.lastShot > this.shotDelay) {
                this.shoot();
                this.lastShot = now;
            }
        }
shoot() {
            bullets.push({
                x: this.x + this.width / 2 - 2,
                y: this.y,
                width: 4,
                height: 15,
                speed: 10
            });
        }
    }
    // Enemy class
    class Enemy {
        constructor() {
            this.emoji = allEmojis[Math.floor(Math.random() * allEmojis.length)];
            this.width = 50;
            this.height = 50;
            this.x = Math.random() * (canvas.width - this.width);
            this.y = -this.height;
            this.speed = 2 + Math.random() * 3;
            this.fireChance = 0.005;
            this.health = 1;
            // Check if emoji is food-related
            this.isFoodEmoji = this.isFoodRelated();
        }
        
        isFoodRelated() {
            // Food-related emoji ranges and specific food emojis
            const foodRanges = [
                [0x1F32D, 0x1F37F], // Food and drink emojis
                [0x1F950, 0x1F96F], // More food emojis
                0x1F363, // Sushi
                0x1F364, // Fried shrimp
                0x1F365, // Fish cake
                0x1F366, // Soft ice cream
                0x1F367, // Shaved ice
            ];
            
            const emojiCode = this.emoji.codePointAt(0);
            
            // Check if emoji is in food ranges
            for (const range of foodRanges) {
                if (Array.isArray(range)) {
                    if (emojiCode >= range[0] && emojiCode <= range[1]) {
                        return true;
                    }
                } else if (emojiCode === range) {
                    return true;
                }
            }
            return false;
        }
draw() {
            ctx.font = '40px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(this.emoji, this.x + this.width / 2, this.y + this.height / 2);
        }
        draw() {
            ctx.font = '40px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            // Brighter emojis with white fill
            if (this.isFoodEmoji) {
                ctx.shadowColor = '#00ff00';
                ctx.shadowBlur = 10;
                ctx.fillStyle = '#ffffff';
                ctx.fillText(this.emoji, this.x + this.width / 2, this.y + this.height / 2);
                ctx.shadowBlur = 0;
            } else {
                ctx.fillStyle = '#ffffff';
                ctx.fillText(this.emoji, this.x + this.width / 2, this.y + this.height / 2);
            }
        }
update() {
            this.y += this.speed;

            // ALL enemies can shoot now
            if (Math.random() < this.fireChance) {
                this.shoot();
            }

            return this.y > canvas.height;
        }
shoot() {
            enemyBullets.push({
                x: this.x + this.width / 2 - 2,
                y: this.y + this.height,
                width: 4,
                height: 15,
                speed: 6
            });
        }
    }
// Particle effects
    class Particle {
        constructor(x, y, color) {
            this.x = x;
            this.y = y;
            this.color = color;
            this.size = Math.random() * 3 + 1;
            this.speedX = Math.random() * 6 - 3;
            this.speedY = Math.random() * 6 - 3;
            this.life = 20;
        }

        update() {
            this.x += this.speedX;
            this.y += this.speedY;
            this.life--;
        }

        draw() {
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // Collision detection
    function checkCollision(obj1, obj2) {
        return obj1.x < obj2.x + obj2.width &&
               obj1.x + obj1.width > obj2.x &&
               obj1.y < obj2.y + obj2.height &&
               obj1.y + obj1.height > obj2.y;
    }

    // Create explosion particles
    function createExplosion(x, y, color, count) {
        for (let i = 0; i < count; i++) {
            particles.push(new Particle(x, y, color));
        }
    }
    // Draw health bar
    function drawHealthBar() {
        const barWidth = canvas.width; // Full width
        const barHeight = 5; // Very thin
        const y = canvas.height - 30;
        
        // Background
        ctx.fillStyle = '#333';
        ctx.fillRect(0, y, barWidth, barHeight);
        
        // Health
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(0, y, (playerHealth / 100) * barWidth, barHeight);
        
        // Border
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.strokeRect(0, y, barWidth, barHeight);
        
        // Health text separate from the bar
        ctx.fillStyle = '#fff';
        ctx.font = '12px Arial';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';
        ctx.fillText(`${playerHealth}/100`, canvas.width - 10, y - 15);
        ctx.textAlign = 'left'; // Reset align
    }
// Draw timer
    function drawTimer() {
        const milliseconds = gameTimer % 1000;
        const seconds = Math.floor(gameTimer / 1000) % 60;
        const minutes = Math.floor(gameTimer / 60000) % 60;
        const hours = Math.floor(gameTimer / 3600000) % 24;
        const days = Math.floor(gameTimer / 86400000);
        
        const timeString = `${days.toString().padStart(2, '0')}:${hours.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}:${milliseconds.toString().padStart(3, '0')}`;
        
        ctx.fillStyle = '#fff';
        ctx.font = '20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(timeString, canvas.width / 2, 40);
    }
// Draw controls hint
    function drawControlsHint() {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('A/D or ←/→ to move • SPACE or Left Click to shoot', canvas.width / 2, canvas.height - 10);
    }
    // Game loop
    function gameLoop() {
        if (!gameActive) return;

        // Update timer
        gameTimer = Date.now() - gameStartTime;

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Update and draw player
        player.update();
        player.draw();

        // Draw health bar
        drawHealthBar();
        
        // Draw timer
        drawTimer();
        
        // Draw controls hint
        drawControlsHint();
        // Spawn enemies
        const now = Date.now();
        if (now - lastEnemySpawn > 1000) {
            enemies.push(new Enemy());
            lastEnemySpawn = now;
        }

        // Update and draw enemies
        for (let i = enemies.length - 1; i >= 0; i--) {
            if (enemies[i].update()) {
                enemies.splice(i, 1);
                // Player loses health when enemy passes
                playerHealth -= 5;
                if (playerHealth <= 0) {
                    gameOver();
                    return;
                }
                continue;
            }

            enemies[i].draw();
            // Check collision with player
            if (checkCollision(player, enemies[i])) {
                if (enemies[i].isFoodEmoji) {
                    // Food emojis heal player
                    playerHealth = Math.min(100, playerHealth + 2);
                    createExplosion(enemies[i].x + enemies[i].width / 2, enemies[i].y + enemies[i].height / 2, '#00ff00', 15);
                } else {
                    playerHealth -= 2;
                    createExplosion(enemies[i].x + enemies[i].width / 2, enemies[i].y + enemies[i].height / 2, '#ff0000', 20);
                }
                enemies.splice(i, 1);
                if (playerHealth <= 0) {
                    gameOver();
                    return;
                }
            }
}
        // Update and draw player bullets
        for (let i = bullets.length - 1; i >= 0; i--) {
            bullets[i].y -= bullets[i].speed;

            // Remove if off screen
            if (bullets[i].y < 0) {
                bullets.splice(i, 1);
                continue;
            }

            // Draw bullet
            ctx.fillStyle = '#00ff00';
            ctx.fillRect(bullets[i].x, bullets[i].y, bullets[i].width, bullets[i].height);

            // Check collision with enemies
            for (let j = enemies.length - 1; j >= 0; j--) {
                if (checkCollision(bullets[i], enemies[j])) {
                    createExplosion(enemies[j].x + enemies[j].width / 2, enemies[j].y + enemies[j].height / 2, '#ff0000', 20);
                    enemies.splice(j, 1);
                    bullets.splice(i, 1);
                    score += 10;
                    scoreDisplay.textContent = `Score: ${score}`;
                    break;
                }
            }
        }

        // Update and draw enemy bullets
        for (let i = enemyBullets.length - 1; i >= 0; i--) {
            enemyBullets[i].y += enemyBullets[i].speed;

            // Remove if off screen
            if (enemyBullets[i].y > canvas.height) {
                enemyBullets.splice(i, 1);
                continue;
            }

            // Draw bullet
            ctx.fillStyle = '#ff0000';
            ctx.fillRect(enemyBullets[i].x, enemyBullets[i].y, enemyBullets[i].width, enemyBullets[i].height);
            // Check collision with player
            if (checkCollision(player, enemyBullets[i])) {
                playerHealth -= 1;
                enemyBullets.splice(i, 1);
                if (playerHealth <= 0) {
                    gameOver();
                    return;
                }
            }
}
// Update and draw particles
        for (let i = particles.length - 1; i >= 0; i--) {
            particles[i].update();
            particles[i].draw();

            if (particles[i].life <= 0) {
                particles.splice(i, 1);
            }
        }

        animationId = requestAnimationFrame(gameLoop);
    }

    // Game over function
    function gameOver() {
        gameActive = false;
        cancelAnimationFrame(animationId);
        finalScoreDisplay.textContent = score;
        gameOverScreen.classList.remove('hidden');
    }
    // Start game function
    function startGame() {
        introScreen.style.opacity = '0';
        setTimeout(() => {
            introScreen.classList.add('hidden');
            gameContainer.classList.remove('hidden');
        }, 1000);

        // Reset game state
        gameActive = true;
        score = 0;
        playerHealth = 100;
        gameStartTime = Date.now();
        gameTimer = 0;
        player = new Player();
        enemies = [];
        bullets = [];
        enemyBullets = [];
        particles = [];
        scoreDisplay.textContent = `Score: ${score}`;
        gameOverScreen.classList.add('hidden');

        gameLoop();
    }
// Event listeners
    playBtn.addEventListener('click', startGame);
    restartBtn.addEventListener('click', startGame);

    // Keyboard controls
    document.addEventListener('keydown', (e) => {
        keys[e.code] = true;
        
        // Prevent spacebar from scrolling
        if (e.code === 'Space') {
            e.preventDefault();
        }
    });

    document.addEventListener('keyup', (e) => {
        keys[e.code] = false;
    });
    // Mouse controls for left click shooting
    document.addEventListener('mousedown', (e) => {
        if (e.button === 0) { // Left click
            keys['Mouse0'] = true;
        }
    });

    document.addEventListener('mouseup', (e) => {
        if (e.button === 0) {
            keys['Mouse0'] = false;
        }
    });
});
