import { Vector2 } from "./vector2.js";
import { gravity, circleDragCoefficient, dragK, gK, REST_THRESHOLD } from "./globals.js";


export class Polygon {
    isAsleep = false;
    asleepTimer = 0;
    constructor(position, vertices, color, mass, bounciness, friction) {
        this.type = "polygon";
        this.force = new Vector2(0, 0);
        this.velocity = new Vector2(0, 0);
        this.acceleration = new Vector2(0, 0);
        this.position = position;
        this.lastPosition = position.clone();

        this.vertices = vertices;
        // bounding radius, set to furthest vertex
        this.radius = Math.max(...this.vertices.map(v => v.magnitude()));
        this.mass = mass
        this.bounciness = bounciness;
        this.friction = friction;

        this.color = color;

    }

    update(dt, airDensity) {
        // console.log(this.velocity.magnitude());
        if (this.isAsleep) return;

        let speed = this.velocity.magnitude();
        // reset the forces to 0
        this.force.mult(0);

        // apply gravity force F=ma
        this.force.sub(gravity.clone().mult(this.mass * gK));

        // apply air resistence REWORK LATER
        // if (speed > 0) {
        //     // Fd = (1/2)(p)(C)(PI)(r^2)(|v|)(v)
        //     // dragK is an arbitrary constant to keep airDensity being 1.225
        //     const dragForce = this.velocity.clone().mult(0.5 * airDensity * circleDragCoefficient * Math.PI * (this.radius ** 2) * speed * dragK);
        //     // larger objects experience more drag, and heavier ones experience less
        //     // let dragStrength = drag * this.radius * 0.2 * (1 / this.mass);

        //     // this.force.add(this.velocity.clone().mult(dragStrength));
        //     this.force.add(dragForce);
        // }

        // convert force to acceleration a = F/ma
        this.acceleration = this.force.clone().mult(1 / this.mass);

        // convert force to velocity
        this.velocity.sub(this.acceleration.clone().mult(dt));

        // convert velocity into position
        this.position.add(this.velocity.clone().mult(dt));

    }

    checkBounds(canvas, dt) {
        if (this.position.y + this.vertices[3].y > canvas.height || this.position.y + this.vertices[0].y < 0) {
            this.velocity.y = 0;

        }
        // snap position
        if (this.position.y + this.vertices[3].y > canvas.height) { // ground
            this.position.y = canvas.height - this.vertices[3].y;
        } else if (this.position.y + this.vertices[0].y < 0) {
            this.position.y = canvas.height - this.vertices[0].y;

        }
    }

    updateBallSleep(dt) {
        return;

    }


    draw(ctx) {
        const worldVerts = this.getWorldVertices();
        ctx.beginPath();
        ctx.moveTo(worldVerts[0].x, worldVerts[0].y);
        for (let i = 0; i < worldVerts.length; i++) {
            ctx.lineTo(worldVerts[i].x, worldVerts[i].y);
        }
        ctx.closePath();
        ctx.fillStyle = this.color;
        ctx.fill();

    }

    // convert local vertex position to world position
    getWorldVertices() {
        return [
            this.position.clone().add(this.vertices[0]), this.position.clone().add(this.vertices[1]),
            this.position.clone().add(this.vertices[2]), this.position.clone().add(this.vertices[3])
        ];
    }

    updateLastPosition() {
        this.lastPosition.x = this.position.x;
        this.lastPosition.y = this.position.y;
    }

    wake() {
        this.asleepTimer = 0;
        this.isAsleep = false;
    }

}