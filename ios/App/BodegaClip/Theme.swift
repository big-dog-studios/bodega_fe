import SwiftUI
import UIKit

/// Brand palette — mirrors the web app (storeLayers.ts).
enum Brand {
    static let blue = Color(red: 0x25 / 255, green: 0x1a / 255, blue: 0xd1 / 255)
    static let orange = Color(red: 0xfe / 255, green: 0xa7 / 255, blue: 0x03 / 255)
    static let red = Color(red: 0xe6 / 255, green: 0x18 / 255, blue: 0x00 / 255)

    static let uiBlue = UIColor(red: 0x25 / 255, green: 0x1a / 255, blue: 0xd1 / 255, alpha: 1)
    static let uiOrange = UIColor(red: 0xfe / 255, green: 0xa7 / 255, blue: 0x03 / 255, alpha: 1)
}

extension Font {
    /// Brand display font (Barlow Condensed) — the web's "display-caps" signage
    /// look. Pair with `.uppercased()` + `.tracking(...)` at the call site.
    static func displayCaps(_ size: CGFloat, extraBold: Bool = false) -> Font {
        .custom(extraBold ? "BarlowCondensed-ExtraBold" : "BarlowCondensed-Bold", size: size)
    }
}
