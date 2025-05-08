// Vector class for 2D mathematics
class Vector {
    x: number;
    y: number;

    constructor(x: number = 0, y: number = 0) {
        this.x = x;
        this.y = y;
    }

    add(v: Vector): Vector {
        this.x += v.x;
        this.y += v.y;
        return this;
    }

    static add(v1: Vector, v2: Vector): Vector {
        return new Vector(v1.x + v2.x, v1.y + v2.y);
    }

    sub(v: Vector): Vector {
        this.x -= v.x;
        this.y -= v.y;
        return this;
    }

    static sub(v1: Vector, v2: Vector): Vector {
        return new Vector(v1.x - v2.x, v1.y - v2.y);
    }

    mult(n: number): Vector {
        this.x *= n;
        this.y *= n;
        return this;
    }

    div(n: number): Vector {
        this.x /= n;
        this.y /= n;
        return this;
    }

    mag(): number {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    }

    normalize(): Vector {
        const m = this.mag();
        if (m !== 0) {
            this.div(m);
        }
        return this;
    }

    setMag(n: number): Vector {
        return this.normalize().mult(n);
    }

    limit(max: number): Vector {
        const mSq = this.x * this.x + this.y * this.y;
        if (mSq > max * max) {
            this.div(Math.sqrt(mSq)).mult(max);
        }
        return this;
    }

    heading(): number {
        return Math.atan2(this.y, this.x);
    }

    static random2D(): Vector {
        return new Vector(Math.random() * 2 - 1, Math.random() * 2 - 1).normalize();
    }
}

// Boid class
class Boid {
    position: Vector;
    velocity: Vector;
    acceleration: Vector;
    maxForce: number; // Maximum steering force
    maxSpeed: number; // Maximum speed - this will be updated by slider
    perceptionRadius: number; // Radius for local flockmates (boid-to-boid)
    mouseAttractionRadius: number; // Radius for mouse attraction
    mouseRepulsionRadius: number;  // Radius for mouse repulsion
    size: number = 5; // Size of the boid triangle
    color: string; // Color of the boid
    path: Vector[] = []; // Stores recent positions for path tracing
    maxPathLength: number = 50; // Max length of the path tail

    constructor(x: number, y: number, initialMaxSpeed: number, color: string) {
        this.position = new Vector(x, y);
        this.velocity = Vector.random2D().mult(Math.random() * 2 + 2); // Random initial velocity
        this.acceleration = new Vector();
        this.maxForce = 0.15; // Max steering force - could also be a slider
        this.maxSpeed = initialMaxSpeed;
        this.perceptionRadius = 50;
        this.mouseAttractionRadius = 150;
        this.mouseRepulsionRadius = 40;
        this.color = color;
    }

    // Method to keep boids within the screen bounds (bouncing)
    edges(width: number, height: number) {
        const buffer = this.size * 2; // Buffer to prevent boids from getting stuck at the very edge

        if (this.position.x > width - buffer) {
            this.position.x = width - buffer;
            this.velocity.x *= -1;
        } else if (this.position.x < buffer) {
            this.position.x = buffer;
            this.velocity.x *= -1;
        }

        if (this.position.y > height - buffer) {
            this.position.y = height - buffer;
            this.velocity.y *= -1;
        } else if (this.position.y < buffer) {
            this.position.y = buffer;
            this.velocity.y *= -1;
        }
    }

    // Alignment: Steer towards the average heading of local flockmates
    align(boids: Boid[]): Vector {
        let steering = new Vector();
        let total = 0;
        for (let other of boids) {
            let d = Vector.sub(other.position, this.position).mag();
            if (other !== this && d < this.perceptionRadius) {
                steering.add(other.velocity);
                total++;
            }
        }
        if (total > 0) {
            steering.div(total);
            steering.setMag(this.maxSpeed);
            steering.sub(this.velocity);
            steering.limit(this.maxForce);
        }
        return steering;
    }

    // Cohesion: Steer to move towards the average position of local flockmates
    cohesion(boids: Boid[]): Vector {
        let steering = new Vector();
        let total = 0;
        for (let other of boids) {
            let d = Vector.sub(other.position, this.position).mag();
            if (other !== this && d < this.perceptionRadius) {
                steering.add(other.position);
                total++;
            }
        }
        if (total > 0) {
            steering.div(total);
            steering.sub(this.position);
            steering.setMag(this.maxSpeed);
            steering.sub(this.velocity);
            steering.limit(this.maxForce);
        }
        return steering;
    }

    // Separation: Steer to avoid crowding local flockmates
    separation(boids: Boid[]): Vector {
        let steering = new Vector();
        let total = 0;
        for (let other of boids) {
            let d = Vector.sub(other.position, this.position).mag();
            if (other !== this && d < this.perceptionRadius / 1.5) { // Slightly larger separation radius for boids
                let diff = Vector.sub(this.position, other.position);
                diff.normalize();
                diff.div(d || 1); // Weight by distance, avoid division by zero
                steering.add(diff);
                total++;
            }
        }
        if (total > 0) {
            steering.div(total);
            steering.setMag(this.maxSpeed);
            steering.sub(this.velocity);
            steering.limit(this.maxForce);
        }
        return steering;
    }

    // Seek: Steer towards a target vector
    seek(target: Vector): Vector {
        let desired = Vector.sub(target, this.position); 
        desired.setMag(this.maxSpeed); 
        let steer = Vector.sub(desired, this.velocity);
        steer.limit(this.maxForce); 
        return steer;
    }

    // Flee: Steer away from a target vector
    flee(target: Vector): Vector {
        let desired = Vector.sub(target, this.position); 
        desired.mult(-1);
        desired.setMag(this.maxSpeed); 
        let steer = Vector.sub(desired, this.velocity);
        steer.limit(this.maxForce * 1.5); 
        return steer;
    }

    // Apply all flocking behaviors
    flock(boids: Boid[], mouseTarget: Vector | null, cursorForceMultiplier: number) {
        let alignment = this.align(boids);
        let cohesionForce = this.cohesion(boids);
        let separationForce = this.separation(boids);
        
        let mouseInteractionForce = new Vector();

        if (mouseTarget) {
            const distToMouse = Vector.sub(mouseTarget, this.position).mag();

            if (distToMouse < this.mouseRepulsionRadius) {
                mouseInteractionForce = this.flee(mouseTarget);
            } else if (distToMouse < this.mouseAttractionRadius) {
                mouseInteractionForce = this.seek(mouseTarget);
            }
        }

        alignment.mult(1.0);
        cohesionForce.mult(0.8);
        separationForce.mult(1.5);
        mouseInteractionForce.mult(cursorForceMultiplier); 

        this.acceleration.add(alignment);
        this.acceleration.add(cohesionForce);
        this.acceleration.add(separationForce);
        this.acceleration.add(mouseInteractionForce);
    }

    update() {
        this.velocity.add(this.acceleration);
        this.velocity.limit(this.maxSpeed);
        this.position.add(this.velocity);
        this.acceleration.mult(0);

        // Add current position to path
        this.path.push(new Vector(this.position.x, this.position.y));
        // Limit path length
        if (this.path.length > this.maxPathLength) {
            this.path.shift(); // Remove the oldest position
        }
    }

    draw(ctx: CanvasRenderingContext2D) {
        const angle = this.velocity.heading();
        ctx.save();
        ctx.translate(this.position.x, this.position.y);
        ctx.rotate(angle);

        ctx.beginPath();
        ctx.moveTo(this.size * 2, 0);
        ctx.lineTo(-this.size, this.size);
        ctx.lineTo(-this.size, -this.size);
        ctx.closePath();

        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.restore();
    }

    drawPath(ctx: CanvasRenderingContext2D) {
        if (this.path.length < 2) return;

        ctx.beginPath();
        ctx.moveTo(this.path[0].x, this.path[0].y);
        for (let i = 1; i < this.path.length; i++) {
            ctx.lineTo(this.path[i].x, this.path[i].y);
        }

        // Create a gradient for the path to make it fade
        const gradient = ctx.createLinearGradient(this.path[0].x, this.path[0].y, this.path[this.path.length - 1].x, this.path[this.path.length - 1].y);
        
        // Convert HEX color to RGBA for opacity control
        let r = parseInt(this.color.slice(1, 3), 16);
        let g = parseInt(this.color.slice(3, 5), 16);
        let b = parseInt(this.color.slice(5, 7), 16);

        gradient.addColorStop(0, `rgba(${r},${g},${b},0)`); // Fades out at the start of the tail
        gradient.addColorStop(1, `rgba(${r},${g},${b},0.8)`); // More opaque near the boid

        ctx.strokeStyle = gradient;
        ctx.lineWidth = this.size / 2; // Adjust line width as needed
        ctx.stroke();
    }
}

// Canvas and context
const canvas = document.getElementById('briansBrainCanvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

// UI Elements
const numBoidsSlider = document.getElementById('numBoidsSlider') as HTMLInputElement;
const numBoidsValueDisplay = document.getElementById('numBoidsValue') as HTMLSpanElement;
const maxSpeedSlider = document.getElementById('maxSpeedSlider') as HTMLInputElement;
const maxSpeedValueDisplay = document.getElementById('maxSpeedValue') as HTMLSpanElement;
const cursorForceSlider = document.getElementById('cursorForceSlider') as HTMLInputElement;
const cursorForceValueDisplay = document.getElementById('cursorForceValue') as HTMLSpanElement;
const pathTracingCheckbox = document.getElementById('pathTracingCheckbox') as HTMLInputElement; // New UI element

// Define a palette of colors for the boid groups
const boidColors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FED766', '#2AB7CA'];

let flock: Boid[] = [];
let numBoidsCurrent = parseInt(numBoidsSlider.value); // Initial value from slider
let currentMaxSpeed = parseFloat(maxSpeedSlider.value); // Initial value from slider
let currentCursorForce = parseFloat(cursorForceSlider.value);
let pathTracingEnabled = false; // Global flag for path tracing

// Mouse state
let mousePosition: Vector | null = null;
let isMouseOverCanvas: boolean = false;

function initializeSimulation() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    flock = [];
    for (let i = 0; i < numBoidsCurrent; i++) {
        // Assign a color by cycling through the boidColors array
        const color = boidColors[i % boidColors.length];
        flock.push(new Boid(Math.random() * canvas.width, Math.random() * canvas.height, currentMaxSpeed, color));
    }

    // Update display values initially
    if (numBoidsValueDisplay) numBoidsValueDisplay.textContent = numBoidsCurrent.toString();
    if (maxSpeedValueDisplay) maxSpeedValueDisplay.textContent = currentMaxSpeed.toFixed(1);
    if (cursorForceValueDisplay) cursorForceValueDisplay.textContent = currentCursorForce.toFixed(1);
    if (pathTracingCheckbox) pathTracingEnabled = pathTracingCheckbox.checked; // Initialize based on checkbox
}

function setupEventListeners() {
    // Mouse listeners for canvas
    canvas.addEventListener('mousemove', (event) => {
        if (isMouseOverCanvas) {
            mousePosition = new Vector(event.offsetX, event.offsetY);
        }
    });
    canvas.addEventListener('mouseenter', () => { isMouseOverCanvas = true; });
    canvas.addEventListener('mouseleave', () => {
        isMouseOverCanvas = false;
        mousePosition = null; 
    });

    // Slider listeners
    numBoidsSlider.addEventListener('input', (event) => {
        numBoidsCurrent = parseInt((event.target as HTMLInputElement).value);
        if (numBoidsValueDisplay) numBoidsValueDisplay.textContent = numBoidsCurrent.toString();
        // Re-initialize simulation for new boid count
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        initializeSimulation(); 
        gameLoop();
    });

    maxSpeedSlider.addEventListener('input', (event) => {
        currentMaxSpeed = parseFloat((event.target as HTMLInputElement).value);
        if (maxSpeedValueDisplay) maxSpeedValueDisplay.textContent = currentMaxSpeed.toFixed(1);
        // Update maxSpeed for all existing boids
        for (let boid of flock) {
            boid.maxSpeed = currentMaxSpeed;
        }
    });

    cursorForceSlider.addEventListener('input', (event) => {
        currentCursorForce = parseFloat((event.target as HTMLInputElement).value);
        if (cursorForceValueDisplay) cursorForceValueDisplay.textContent = currentCursorForce.toFixed(1);
        // No need to update boids directly or re-initialize; force is applied in flock()
    });

    // Checkbox listener for path tracing
    if (pathTracingCheckbox) {
        pathTracingCheckbox.addEventListener('change', (event) => {
            pathTracingEnabled = (event.target as HTMLInputElement).checked;
        });
    }

    window.addEventListener('resize', handleResize);
}

let animationFrameId: number | null = null;

function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let boid of flock) {
        boid.edges(canvas.width, canvas.height);
        boid.flock(flock, mousePosition, currentCursorForce);
        boid.update();
        if (pathTracingEnabled) {
            boid.drawPath(ctx); // Draw path first so boid is on top
        }
        boid.draw(ctx);
    }

    animationFrameId = requestAnimationFrame(gameLoop);
}

function handleResize() {
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
    }
    initializeSimulation(); 
    gameLoop();
}

// Start the simulation
initializeSimulation(); // Initial setup of boids
setupEventListeners(); // Setup all event listeners once
gameLoop(); // Start the main loop 