import { assertEnum, assertUInt8 } from '../../assert.js';
import { UhkBuffer } from '../../uhk-buffer.js';
import { KeyModifiers } from '../key-modifiers.js';
import { SecondaryRoleAction } from '../secondary-role-action.js';
import { SerialisationInfo } from '../serialisation-info.js';
import { KeyAction, KeyActionId, keyActionType } from './key-action.js';
import { KeystrokeType } from './keystroke-type.js';

export enum KeystrokeActionFlag {
    scancode = 1 << 0,
    modifierMask = 1 << 1,
    secondaryRoleAction = 1 << 2
}

const KEYSTROKE_ACTION_FLAG_LENGTH = 3;

export interface JsonObjectKeystrokeAction {
    keyActionType: string;
    scancode?: number;
    modifierMask?: number;
    secondaryRoleAction?: string;
    type?: string;
}

const MODIFIERS = ['LCtrl', 'LShift', 'LAlt', 'LSuper', 'RCtrl', 'RShift', 'RAlt', 'RSuper'];

export class KeystrokeAction extends KeyAction {

    set scancode(scancode: number) {
        this._scancode = scancode;
        if (this.type !== KeystrokeType.shortMedia && this.type !== KeystrokeType.longMedia) {
            return;
        }
        this.type = scancode < 256 ? KeystrokeType.shortMedia : KeystrokeType.longMedia;
    }

    get scancode() {
        return this._scancode;
    }

    @assertUInt8 modifierMask: number;

    @assertEnum(SecondaryRoleAction) secondaryRoleAction: SecondaryRoleAction;

    set type(type: KeystrokeType) {
        if (type === KeystrokeType.shortMedia || type === KeystrokeType.longMedia) {
            type = this.scancode < 256 ? KeystrokeType.shortMedia : KeystrokeType.longMedia;
        }
        this._type = type;
    }

    get type() {
        return this._type;
    }

    private _scancode: number;

    @assertEnum(KeystrokeType)
    private _type: KeystrokeType;

    constructor(other?: KeystrokeAction) {
        super(other);
        if (!other) {
            return;
        }
        this.type = other.type;
        this._scancode = other._scancode;
        this.modifierMask = other.modifierMask;
        this.secondaryRoleAction = other.secondaryRoleAction;
    }

    fromJsonObject(jsonObject: JsonObjectKeystrokeAction, serialisationInfo: SerialisationInfo): KeystrokeAction {
        switch (serialisationInfo.userConfigMajorVersion) {
            case 1:
            case 2:
            case 3:
            case 4:
            case 5:
                this.fromJsonObjectV1(jsonObject);
                break;

            case 6:
            case 7:
            case 8:
            case 9:
            case 11:
            case 12:
                this.fromJsonObjectV6(jsonObject, serialisationInfo);
                break;

            default:
                throw new Error(`Keystroke action does not support version: ${serialisationInfo.userConfigMajorVersion}`);
        }

        return this;
    }

    fromBinary(buffer: UhkBuffer, serialisationInfo: SerialisationInfo): KeystrokeAction {
        switch (serialisationInfo.userConfigMajorVersion) {
            case 1:
            case 2:
            case 3:
            case 4:
            case 5:
                this.fromBinaryV1(buffer);
                break;

            case 6:
            case 7:
            case 8:
            case 9:
            case 11:
            case 12:
                this.fromBinaryV6(buffer, serialisationInfo);
                break;


            default:
                throw new Error(`Keystroke action does not support version: ${serialisationInfo.userConfigMajorVersion}`);
        }

        return this;
    }

    toJsonObject(serialisationInfo: SerialisationInfo): JsonObjectKeystrokeAction {
        const jsonObject: JsonObjectKeystrokeAction = {
            keyActionType: keyActionType.KeystrokeAction
        };

        if (this.type === KeystrokeType.shortMedia || this.type === KeystrokeType.longMedia) {
            jsonObject.type = 'media';
        } else {
            jsonObject.type = KeystrokeType[this.type];
        }

        if (this.hasScancode()) {
            jsonObject.scancode = this._scancode;
        }

        if (this.hasActiveModifier()) {
            jsonObject.modifierMask = this.modifierMask;
        }

        if (this.hasSecondaryRoleAction()) {
            jsonObject.secondaryRoleAction = SecondaryRoleAction[this.secondaryRoleAction];
        }

        return {
            ...jsonObject,
            ...this.rgbColorToJson(serialisationInfo)
        };
    }

    toBinary(buffer: UhkBuffer, serialisationInfo: SerialisationInfo) {
        let flags = 0;
        const toWrite: {
            data: number,
            long: boolean
        }[] = [];

        if (this.hasScancode()) {
            flags |= KeystrokeActionFlag.scancode;
            toWrite.push({data: this._scancode, long: this.type === KeystrokeType.longMedia});
        }

        if (this.hasActiveModifier()) {
            flags |= KeystrokeActionFlag.modifierMask;
            toWrite.push({data: this.modifierMask, long: false});
        }

        if (this.hasSecondaryRoleAction()) {
            flags |= KeystrokeActionFlag.secondaryRoleAction;
            toWrite.push({data: this.secondaryRoleAction, long: false});
        }

        const TYPE_OFFSET = flags + (this.type << KEYSTROKE_ACTION_FLAG_LENGTH);

        buffer.writeUInt8(KeyActionId.NoneAction + TYPE_OFFSET); // NoneAction is the same as an empty KeystrokeAction.

        for (let i = 0; i < toWrite.length; ++i) {
            if (toWrite[i].long) {
                buffer.writeUInt16(toWrite[i].data);
            } else {
                buffer.writeUInt8(toWrite[i].data);
            }
        }

        this.rgbColorToBinary(buffer, serialisationInfo);
    }

    toString(): string {
        const properties: string[] = [];
        properties.push(`type="${KeystrokeType[this.type]}"`);

        if (this.hasScancode()) {
            properties.push(`scancode="${this._scancode}"`);
        }
        if (this.hasActiveModifier()) {
            properties.push(`modifierMask="${this.modifierMask}"`);
        }
        if (this.hasSecondaryRoleAction()) {
            properties.push(`secondaryRoleAction="${this.secondaryRoleAction}"`);
        }

        return `<KeystrokeAction ${properties.join(' ')}>`;
    }

    isActive(modifier: KeyModifiers): boolean {
        return (this.modifierMask & modifier) > 0;
    }

    hasActiveModifier(): boolean {
        return this.modifierMask > 0;
    }

    hasSecondaryRoleAction(): boolean {
        return this.secondaryRoleAction !== undefined && this.secondaryRoleAction !== null;
    }

    hasScancode(): boolean {
        return !!this._scancode;
    }

    hasOnlyOneActiveModifier(): boolean {
        return this.modifierMask !== 0 && !(this.modifierMask & this.modifierMask - 1);
    }

    getModifierList(): string[] {
        const modifierList: string[] = [];
        let modifierMask = this.modifierMask;
        for (let i = 0; modifierMask !== 0; ++i, modifierMask >>= 1) {
            if (modifierMask & 1) {
                modifierList.push(MODIFIERS[i]);
            }
        }
        return modifierList;
    }

    public getName(): string {
        return 'KeystrokeAction';
    }

    private fromJsonObjectV1(jsonObject: JsonObjectKeystrokeAction): void {
        this.assertKeyActionType(jsonObject);
        if (jsonObject.type === 'media') {
            this.type = jsonObject.scancode < 256 ? KeystrokeType.shortMedia : KeystrokeType.longMedia;
        } else {
            this.type = KeystrokeType[jsonObject.type];
        }

        this._scancode = jsonObject.scancode;
        this.modifierMask = jsonObject.modifierMask;
        this.secondaryRoleAction = SecondaryRoleAction[jsonObject.secondaryRoleAction];
    }

    private fromJsonObjectV6(jsonObject: JsonObjectKeystrokeAction, serialisationInfo: SerialisationInfo): void {
        this.fromJsonObjectV1(jsonObject);
        this.rgbColorFromJson(jsonObject, serialisationInfo);
    }

    private fromBinaryV1(buffer: UhkBuffer): void {
        const keyActionId: KeyActionId = this.readAndAssertKeyActionId(buffer);
        const flags: number = keyActionId - KeyActionId.NoneAction; // NoneAction is the same as an empty KeystrokeAction.
        this.type = (flags >> 3) & 0b11;
        if (flags & KeystrokeActionFlag.scancode) {
            this._scancode = this.type === KeystrokeType.longMedia ? buffer.readUInt16() : buffer.readUInt8();
        }
        if (flags & KeystrokeActionFlag.modifierMask) {
            this.modifierMask = buffer.readUInt8();
        }
        if (flags & KeystrokeActionFlag.secondaryRoleAction) {
            this.secondaryRoleAction = buffer.readUInt8();
        }
    }

    private fromBinaryV6(buffer: UhkBuffer, serialisationInfo: SerialisationInfo): void {
        this.fromBinaryV1(buffer);
        this.rgbColorFromBinary(buffer, serialisationInfo);
    }
}
