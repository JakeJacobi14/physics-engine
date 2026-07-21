import { Vector2 } from "./vector2.js";
import { gravity, circleDragCoefficient, dragK, gK } from "./globals.js";

export class RigidBody {
    isAsleep = false;
    asleepTimer = 0;
    isBeingDragged = false;

    constructor(position, color, mass, bounciness, friction) {
        this.force = new Vector2(0, 0);
        this.velocity = new Vector2(0, 0);
        this.acceleration = new Vector2(0, 0);
        this.position = position;
        this.lastPosition = position.clone();
        this.mass = mass;
        this.bounciness = bounciness;
        this.friction = friction;
        this.color = color;
    }

    update(dt, airDensity) {
        if (this.isAsleep) return;
        // reset the forces to 0
        this.force.mult(0);
        // apply gravity force F=ma
        this.force.sub(gravity.clone().mult(this.mass * gK));

        // air resistance
        this.handleDrag(airDensity);

        // convert force to acceleration a = F/ma
        this.acceleration = this.force.clone().mult(1 / this.mass);

        // convert force to velocity
        this.velocity.sub(this.acceleration.clone().mult(dt));
        
        // convert velocity into position
        this.position.add(this.velocity.clone().mult(dt));
    }

    bounce(dir) {
        // normalize direction vector
        const normal = dir.normalize();

        // compute the dot product of the x and y vectors
        const vDotN = this.velocity.dotProduct(normal);

        // apply velocity change
        // vVelocity -= vNormal * v dot n * (1 + bounciness)
        this.velocity.sub(normal.clone().mult(vDotN * (1 + this.bounciness)));
    }

    wake() {
        this.asleepTimer = 0;
        this.isAsleep = false;
    }

    updateLastPosition() {
        this.lastPosition.x = this.position.x;
        this.lastPosition.y = this.position.y;
    }

    updateBallSleep(dt) {
    }
}