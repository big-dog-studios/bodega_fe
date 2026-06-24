import StoreKit
import SwiftUI
import UIKit

/// Tapped-bodega peek: name, address, a few feature badges, and a CTA that
/// presents Apple's SKOverlay to install the full app.
struct TeaserSheet: View {
    let license: String
    @State private var detail: StoreDetail?
    @State private var loading = true

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            if let detail {
                Text(detail.dba)
                    .font(.title2.bold())
                    .lineLimit(2)
                if let line = addressLine(detail) {
                    Text(line)
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 6) {
                        ForEach(badges(detail), id: \.self) { badge in
                            Text(LocalizedStringKey(badge))
                                .font(.system(size: 12, weight: .bold))
                                .padding(.horizontal, 10)
                                .padding(.vertical, 6)
                                .background(Brand.orange.opacity(0.2))
                                .clipShape(Capsule())
                        }
                    }
                }
            } else if loading {
                ProgressView().frame(maxWidth: .infinity)
            } else {
                Text("Couldn't load this bodega.")
                    .foregroundColor(.secondary)
            }

            Spacer(minLength: 0)

            Button(action: presentInstallOverlay) {
                Text("Get the app for full details")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(Brand.blue)
                    .foregroundColor(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
            }
        }
        .padding(20)
        .task { await load() }
    }

    private func load() async {
        detail = try? await APIClient.detail(license)
        loading = false
    }

    private func addressLine(_ d: StoreDetail) -> String? {
        let street = [d.house, d.street].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " ")
        let parts = [street, d.city, d.county, d.zip].filter { !($0?.isEmpty ?? true) }.compactMap { $0 }
        return parts.isEmpty ? nil : parts.joined(separator: ", ")
    }

    /// Localization keys (English source strings) — mirror the web feature labels.
    private func badges(_ d: StoreDetail) -> [String] {
        var out: [String] = []
        if d.alc_class != nil { out.append("BEER & WINE") }
        if d.has_prepared_food == true { out.append("HOT FOOD") }
        if d.has_snap == true { out.append("SNAP/EBT") }
        if d.has_lottery == true { out.append("LOTTERY") }
        if d.has_tobacco == true { out.append("TOBACCO") }
        if d.has_atm == true { out.append("ATM") }
        if d.has_cat == true { out.append("CAT") }
        if d.delivery == true { out.append("DELIVERY") }
        if d.takeout == true { out.append("TAKEOUT") }
        if d.has_wic == true { out.append("WIC") }
        if d.has_quick_draw == true { out.append("QUICK DRAW") }
        return out
    }

    /// Recommend the full app via the App Store overlay (no app id needed —
    /// SKOverlay resolves the clip's associated full app).
    private func presentInstallOverlay() {
        guard
            let scene = UIApplication.shared.connectedScenes
                .first(where: { $0.activationState == .foregroundActive }) as? UIWindowScene
        else { return }
        let config = SKOverlay.AppClipConfiguration(position: .bottom)
        SKOverlay(configuration: config).present(in: scene)
    }
}
