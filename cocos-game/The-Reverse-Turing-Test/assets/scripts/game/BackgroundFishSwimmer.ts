import { _decorator, Component, Node, UITransform, Vec3 } from 'cc';

const { ccclass, property } = _decorator;

@ccclass('BackgroundFishSwimmer')
export class BackgroundFishSwimmer extends Component {
    @property(Node)
    swimContainer: Node = null!;

    @property
    speed = 55;

    private _target = new Vec3();
    private _halfWidth = 0;
    private _halfHeight = 0;

    start(): void {
        this.refreshBounds();
        this.pickNextTarget();
    }

    update(dt: number): void {
        if (!this.swimContainer || !this.swimContainer.isValid) {
            return;
        }

        const current = this.node.position.clone();
        const delta = Vec3.subtract(new Vec3(), this._target, current);
        const distance = delta.length();

        if (distance <= 1) {
            this.pickNextTarget();
            return;
        }

        delta.normalize();

        const moveX = delta.x * this.speed * dt;
        const moveY = delta.y * this.speed * dt;

        const nextX = this.clamp(current.x + moveX, -this._halfWidth, this._halfWidth);
        const nextY = this.clamp(current.y + moveY, -this._halfHeight, this._halfHeight);

        this.node.setPosition(nextX, nextY, 0);

        const scale = this.node.scale;
        const facingLeft = delta.x < 0;
        this.node.setScale(facingLeft ? -Math.abs(scale.x) : Math.abs(scale.x), scale.y, scale.z);
    }

    private refreshBounds(): void {
        const transform = this.swimContainer?.getComponent(UITransform);
        if (!transform) {
            this._halfWidth = 300;
            this._halfHeight = 300;
            return;
        }

        // Keep a small edge margin so fish does not clip out of the container.
        this._halfWidth = Math.max(10, transform.width * 0.5 - 30);
        this._halfHeight = Math.max(10, transform.height * 0.5 - 30);
    }

    private pickNextTarget(): void {
        this.refreshBounds();
        this._target.set(
            this.randomRange(-this._halfWidth, this._halfWidth),
            this.randomRange(-this._halfHeight, this._halfHeight),
            0
        );
    }

    private randomRange(min: number, max: number): number {
        return min + Math.random() * (max - min);
    }

    private clamp(value: number, min: number, max: number): number {
        return Math.max(min, Math.min(max, value));
    }
}
