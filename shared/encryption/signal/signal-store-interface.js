"use strict";
/**
 * Signal Protocol Store Interface
 *
 * Platform-agnostic interfaces for Signal Protocol storage.
 * Implementations will use database (Node.js) or IndexedDB (Browser).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Direction = void 0;
/**
 * Direction for identity key trust decisions
 */
var Direction;
(function (Direction) {
    Direction[Direction["Sending"] = 0] = "Sending";
    Direction[Direction["Receiving"] = 1] = "Receiving";
})(Direction || (exports.Direction = Direction = {}));
//# sourceMappingURL=signal-store-interface.js.map