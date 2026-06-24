import StoreKit
import SwiftUI
import UIKit

/// Tapped-bodega peek, styled like the core app's detail sheet: brand-blue
/// surface, orange uppercase name with a red hard-shadow, outlined badges, and
/// a CTA that presents Apple's SKOverlay to install the full app.
struct TeaserSheet: View {
    let license: String
    @State private var detail: StoreDetail?
    @State private var loading = true

    var body: some View {
        ZStack {
            Brand.blue.ignoresSafeArea()

            VStack(alignment: .leading, spacing: 0) {
                if let detail {
                    VStack(alignment: .leading, spacing: 8) {
                        Text(detail.dba.uppercased())
                            .font(.displayCaps(34, extraBold: true))
                            .foregroundColor(Brand.orange)
                            .shadow(color: Brand.red, radius: 0, x: 2, y: 2)
                            .fixedSize(horizontal: false, vertical: true)
                            .lineLimit(2)

                        if let line = addressLine(detail) {
                            Text(line.uppercased())
                                .font(.displayCaps(15))
                                .tracking(1)
                                .foregroundColor(Brand.orange)
                        }

                        let tags = badges(detail)
                        if !tags.isEmpty {
                            ScrollView(.horizontal, showsIndicators: false) {
                                HStack(spacing: 8) {
                                    ForEach(tags, id: \.self) { TeaserBadge(label: $0) }
                                }
                            }
                            .padding(.top, 4)
                        }
                    }
                    .padding(20)
                } else if loading {
                    ProgressView()
                        .tint(Brand.orange)
                        .frame(maxWidth: .infinity)
                        .padding(40)
                } else {
                    Text("Couldn't load this bodega.")
                        .foregroundColor(.white.opacity(0.8))
                        .padding(20)
                }

                Spacer(minLength: 0)

                Button(action: presentInstallOverlay) {
                    Text("Get the app for full details")
                        .textCase(.uppercase)
                        .font(.displayCaps(20, extraBold: true))
                        .tracking(1)
                        .foregroundColor(Brand.blue)
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Brand.orange)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                }
                .buttonStyle(.plain)
                .padding(20)
            }
        }
        .task { await load() }
    }

    private func load() async {
        detail = try? await APIClient.detail(license)
        loading = false
    }

    private func addressLine(_ d: StoreDetail) -> String? {
        let street = [d.house, d.street].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " ")
        let parts = [street, d.city, d.county, d.zip].compactMap { $0 }.filter { !$0.isEmpty }
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

/// Outlined orange feature tag — mirrors the web's `.feature-badge`.
struct TeaserBadge: View {
    let label: String

    var body: some View {
        Text(LocalizedStringKey(label))
            .font(.displayCaps(13))
            .tracking(0.7)
            .foregroundColor(Brand.orange)
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .overlay(RoundedRectangle(cornerRadius: 4).stroke(Brand.orange, lineWidth: 2))
    }
}
