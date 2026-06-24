import Capacitor
import CoreSpotlight
import Foundation
import UIKit
import UniformTypeIdentifiers

/// Local Capacitor plugin: indexes bodegas/categories into iOS Spotlight.
/// Result taps are routed by AppRouterPlugin (a tapped result is just a deep link).
/// JS side: registerPlugin('Spotlight').
@objc(SpotlightPlugin)
public class SpotlightPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SpotlightPlugin"
    public let jsName = "Spotlight"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "index", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "delete", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clear", returnType: CAPPluginReturnPromise),
    ]

    private lazy var thumbnailData: Data? = Self.makeThumbnail()

    @objc func index(_ call: CAPPluginCall) {
        let raw = call.getArray("items") ?? []
        var searchable: [CSSearchableItem] = []
        for case let obj as JSObject in raw {
            guard let id = obj["id"] as? String, let title = obj["title"] as? String else { continue }
            let attrs = CSSearchableItemAttributeSet(contentType: UTType.item)
            attrs.title = title
            attrs.contentDescription = obj["subtitle"] as? String
            if let keywords = (obj["keywords"] as? [Any])?.compactMap({ $0 as? String }) {
                attrs.keywords = keywords
            }
            attrs.thumbnailData = thumbnailData
            searchable.append(
                CSSearchableItem(
                    uniqueIdentifier: id,
                    domainIdentifier: obj["domain"] as? String,
                    attributeSet: attrs
                )
            )
        }
        guard !searchable.isEmpty else {
            call.resolve()
            return
        }
        CSSearchableIndex.default().indexSearchableItems(searchable) { error in
            if let error = error {
                call.reject(error.localizedDescription)
            } else {
                call.resolve()
            }
        }
    }

    @objc func delete(_ call: CAPPluginCall) {
        let ids = (call.getArray("ids") ?? []).compactMap { $0 as? String }
        guard !ids.isEmpty else { call.resolve(); return }
        CSSearchableIndex.default().deleteSearchableItems(withIdentifiers: ids) { error in
            if let error = error { call.reject(error.localizedDescription) } else { call.resolve() }
        }
    }

    @objc func clear(_ call: CAPPluginCall) {
        guard let domain = call.getString("domain") else { call.resolve(); return }
        CSSearchableIndex.default().deleteSearchableItems(withDomainIdentifiers: [domain]) { error in
            if let error = error { call.reject(error.localizedDescription) } else { call.resolve() }
        }
    }

    /// Small brand B-pin used as the result thumbnail for every item.
    private static func makeThumbnail() -> Data? {
        let size = CGSize(width: 120, height: 120)
        let image = UIGraphicsImageRenderer(size: size).image { _ in
            let blue = UIColor(red: 0x25 / 255, green: 0x1a / 255, blue: 0xd1 / 255, alpha: 1)
            let orange = UIColor(red: 0xfe / 255, green: 0xa7 / 255, blue: 0x03 / 255, alpha: 1)
            let rect = CGRect(x: 16, y: 16, width: 88, height: 88)
            let path = UIBezierPath(roundedRect: rect, cornerRadius: 22)
            blue.setFill()
            path.fill()
            orange.setStroke()
            path.lineWidth = 8
            path.stroke()
            let font = UIFont(name: "BarlowCondensed-ExtraBold", size: 62)
                ?? UIFont.systemFont(ofSize: 54, weight: .heavy)
            let str = NSAttributedString(string: "B", attributes: [.font: font, .foregroundColor: orange])
            let ts = str.size()
            str.draw(at: CGPoint(
                x: (size.width - ts.width) / 2,
                y: size.height / 2 - font.ascender + font.capHeight / 2
            ))
        }
        return image.pngData()
    }
}
