import {
    _decorator,
    assetManager,
    Component,
    director,
    ImageAsset,
    Node,
    Sprite,
    SpriteFrame,
    Texture2D,
    UITransform
} from 'cc';
import { PRESET_FISH_BASE64 } from '../data/PresetFishBase64';
import { BackgroundFishSwimmer } from './BackgroundFishSwimmer';

const { ccclass, property } = _decorator;

@ccclass('PresetFishSwimSpawner')
export class PresetFishSwimSpawner extends Component {
    @property(Node)
    fishSwimContainer: Node = null!;

    @property
    spawnCount = 3;

    @property
    retryIntervalSeconds = 0.5;

    @property
    maxRetryCount = 8;

    private _spawned = false;
    private _retryCount = 0;

    start(): void {
        if (!this.isTargetScene()) {
            return;
        }
        this.scheduleSpawnAttempt(0);
    }

    private isTargetScene(): boolean {
        const sceneName = this.node.scene?.name || director.getScene()?.name;
        return sceneName === 'MultiPlayerScene';
    }

    private scheduleSpawnAttempt(delaySeconds: number): void {
        this.scheduleOnce(() => {
            void this.spawnPresetFish();
        }, delaySeconds);
    }

    private async spawnPresetFish(): Promise<void> {
        if (this._spawned || !this.isValid || !this.node.isValid) {
            return;
        }

        if (!this.isTargetScene()) {
            return;
        }

        const container = this.resolveContainer();
        if (!container) {
            this.retryLater('[PresetFishSwimSpawner] Missing swim container.');
            return;
        }

        if (this.hasExistingPresetFish(container)) {
            this._spawned = true;
            return;
        }

        const entries = PRESET_FISH_BASE64.slice(0, this.spawnCount);
        if (entries.length === 0) {
            console.warn('[PresetFishSwimSpawner] No preset fish base64 entries available.');
            return;
        }

        const containerTransform = container.getComponent(UITransform);
        const halfWidth = containerTransform ? containerTransform.width * 0.5 : 320;
        const halfHeight = containerTransform ? containerTransform.height * 0.5 : 320;
        let spawnedCount = 0;

        for (const [index, fish] of entries.entries()) {
            const fishNode = new Node(`PresetFish_${fish.id}`);
            fishNode.setParent(container);
            fishNode.setPosition(
                this.randomRange(-halfWidth + 20, halfWidth - 20),
                this.randomRange(-halfHeight + 20, halfHeight - 20),
                0
            );

            const sprite = fishNode.addComponent(Sprite);
            const spriteFrame = await this.loadSpriteFrameFromDataUrl(fish.imageData);
            if (spriteFrame) {
                sprite.spriteFrame = spriteFrame;
            } else {
                fishNode.destroy();
                continue;
            }

            const fishScale = 0.18 + index * 0.01;
            fishNode.setScale(fishScale, fishScale, 1);

            const swimmer = fishNode.addComponent(BackgroundFishSwimmer);
            swimmer.swimContainer = container;
            swimmer.speed = this.randomRange(35, 65);
            spawnedCount += 1;
        }

        this._spawned = true;
        console.log(`[PresetFishSwimSpawner] Spawned ${spawnedCount}/${entries.length} fish.`);
    }

    private retryLater(reason: string): void {
        this._retryCount += 1;
        const sceneName = this.node.scene?.name ?? 'UnknownScene';
        if (this._retryCount > this.maxRetryCount) {
            console.warn(`${reason} Scene=${sceneName}, retries exhausted.`);
            return;
        }

        console.warn(`${reason} Scene=${sceneName}, retry ${this._retryCount}/${this.maxRetryCount}.`);
        this.scheduleSpawnAttempt(this.retryIntervalSeconds);
    }

    private hasExistingPresetFish(container: Node): boolean {
        return container.children.some((child) => child.name.startsWith('PresetFish_'));
    }

    private resolveContainer(): Node | null {
        if (this.fishSwimContainer && this.fishSwimContainer.isValid && this.fishSwimContainer.activeInHierarchy) {
            return this.fishSwimContainer;
        }

        const root = this.node.scene || director.getScene();
        if (!root) {
            return null;
        }

        // Keep compatibility with existing scene naming.
        const found = this.findFirstActiveNodeByNames(root, [
            'FishSwinContainer',
            'FishSwimContainer',
            'FishContainer'
        ]);
        if (found) {
            this.fishSwimContainer = found;
            return found;
        }

        const inactiveFound = this.findFirstNodeByNames(root, [
            'FishSwinContainer',
            'FishSwimContainer',
            'FishContainer'
        ]);
        if (inactiveFound) {
            console.warn(`[PresetFishSwimSpawner] Found inactive swim container '${inactiveFound.name}', creating visible fallback.`);
        }

        return this.createFallbackSwimContainer(root);
    }

    private createFallbackSwimContainer(root: Node): Node {
        const host = this.findNodeByName(root, 'Canvas') || root;
        const existing = this.findNodeByName(host, 'FishSwinContainer');
        const container = existing || new Node('FishSwinContainer');
        if (!container.parent) {
            container.setParent(host);
            container.setPosition(0, 0, 0);
        }
        container.active = true;

        let transform = container.getComponent(UITransform);
        if (!transform) {
            transform = container.addComponent(UITransform);
        }

        const hostTransform = host.getComponent(UITransform);
        const width = hostTransform?.width || 750;
        const height = hostTransform?.height || 1334;
        transform.setContentSize(width, height);

        // Keep fish above background, below interactive UI.
        if (container.parent && container.parent.children.length > 1) {
            container.setSiblingIndex(1);
        }

        this.fishSwimContainer = container;

        console.warn('[PresetFishSwimSpawner] Created fallback FishSwinContainer under Canvas.');
        return container;
    }

    private findFirstNodeByNames(root: Node, names: string[]): Node | null {
        for (const name of names) {
            const found = this.findNodeByName(root, name);
            if (found) {
                return found;
            }
        }
        return null;
    }

    private findFirstActiveNodeByNames(root: Node, names: string[]): Node | null {
        for (const name of names) {
            const found = this.findNodeByName(root, name);
            if (found && found.activeInHierarchy) {
                return found;
            }
        }
        return null;
    }

    private findNodeByName(root: Node, name: string): Node | null {
        if (root.name === name) {
            return root;
        }
        for (const child of root.children) {
            const found = this.findNodeByName(child, name);
            if (found) {
                return found;
            }
        }
        return null;
    }

    private loadSpriteFrameFromDataUrl(dataUrl: string): Promise<SpriteFrame | null> {
        return new Promise((resolve) => {
            this.loadWithImageFactory(dataUrl).then((spriteFrame) => {
                if (spriteFrame) {
                    resolve(spriteFrame);
                    return;
                }
                void this.loadWithAssetManager(dataUrl).then(resolve);
            });
        });
    }

    private loadWithImageFactory(dataUrl: string): Promise<SpriteFrame | null> {
        const globalObj = globalThis as any;
        const imageFactory = this.getImageFactory(globalObj);
        if (!imageFactory) {
            return Promise.resolve(null);
        }

        return new Promise((resolve) => {
            const image = imageFactory();
            let settled = false;
            const timeout = setTimeout(() => {
                if (settled) {
                    return;
                }
                settled = true;
                cleanup();
                resolve(null);
            }, 5000);

            const cleanup = () => {
                clearTimeout(timeout);
                image.onload = null;
                image.onerror = null;
            };

            image.onload = () => {
                if (settled) {
                    return;
                }
                settled = true;
                cleanup();
                const imageAsset = new ImageAsset();
                imageAsset.reset(image);
                resolve(this.createSpriteFrame(imageAsset));
            };

            image.onerror = (error: unknown) => {
                if (settled) {
                    return;
                }
                settled = true;
                cleanup();
                console.warn('[PresetFishSwimSpawner] Image factory decode failed:', error);
                resolve(null);
            };

            image.src = dataUrl;
        });
    }

    private loadWithAssetManager(dataUrl: string): Promise<SpriteFrame | null> {
        return new Promise((resolve) => {
            let settled = false;
            const timeout = setTimeout(() => {
                if (settled) {
                    return;
                }
                settled = true;
                resolve(null);
            }, 5000);

            assetManager.loadRemote<ImageAsset>(dataUrl, (err, imageAsset) => {
                if (settled) {
                    return;
                }
                settled = true;
                clearTimeout(timeout);
                if (err || !imageAsset) {
                    console.error('[PresetFishSwimSpawner] Load base64 image failed:', err);
                    resolve(null);
                    return;
                }

                resolve(this.createSpriteFrame(imageAsset));
            });
        });
    }

    private getImageFactory(globalObj: any): (() => any) | null {
        if (globalObj?.wx && typeof globalObj.wx.createImage === 'function') {
            return () => globalObj.wx.createImage();
        }
        if (typeof Image !== 'undefined') {
            return () => new Image();
        }
        return null;
    }

    private createSpriteFrame(imageAsset: ImageAsset): SpriteFrame {
        const texture = new Texture2D();
        texture.image = imageAsset;

        const spriteFrame = new SpriteFrame();
        spriteFrame.texture = texture;
        return spriteFrame;
    }

    private randomRange(min: number, max: number): number {
        return min + Math.random() * (max - min);
    }
}
