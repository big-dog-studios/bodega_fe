import CoreLocation
import SwiftUI

/// Identifiable wrapper so a selected license can drive `.sheet(item:)`.
struct SelectedStore: Identifiable {
    let license: String
    var id: String { license }
}

/// The whole clip: map + floating filter FAB + locate button + teaser sheet.
struct RootView: View {
    @StateObject private var location = LocationManager()
    @State private var pins: [StorePin] = []
    @State private var bbox: Bbox?
    @State private var active: Set<String> = []
    @State private var selected: SelectedStore?
    @State private var recenterTo: CLLocationCoordinate2D?
    @State private var didAutoCenter = false
    @State private var filtersOpen = false
    @State private var fetchTask: Task<Void, Never>?

    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            BodegaMapView(
                pins: pins,
                recenterTo: $recenterTo,
                onRegionSettled: { newBbox in
                    bbox = newBbox
                    reload()
                },
                onSelect: { selected = SelectedStore(license: $0) }
            )
            .ignoresSafeArea()

            // Tap-outside scrim that dismisses the open filter list.
            if filtersOpen {
                Color.clear
                    .contentShape(Rectangle())
                    .ignoresSafeArea()
                    .onTapGesture { withAnimation(.easeOut(duration: 0.18)) { filtersOpen = false } }
            }

            VStack(alignment: .trailing, spacing: 12) {
                if !filtersOpen {
                    Button(action: locate) {
                        controlTile { Image(systemName: "location.fill") }
                    }
                    .buttonStyle(.plain)
                }
                FilterFab(active: $active, open: $filtersOpen)
            }
            .padding(20)
        }
        .onChange(of: active) { _ in reload() }
        .sheet(item: $selected) { sel in
            TeaserSheet(license: sel.license)
                .presentationDetents([.height(300)])
        }
        .onAppear { location.request() }
        .onChange(of: location.coord) { newCoord in
            // First fix → drop the user onto their location (the clip's whole point).
            guard let c = newCoord, !didAutoCenter else { return }
            didAutoCenter = true
            recenterTo = c.clCoordinate
        }
    }

    private func locate() {
        if let c = location.coord {
            recenterTo = c.clCoordinate
        } else {
            location.request()
        }
    }

    private func reload() {
        guard let bbox else { return }
        let params = Filters.all.filter { active.contains($0.key) }.map(\.param)
        fetchTask?.cancel()
        fetchTask = Task {
            guard let result = try? await APIClient.pins(bbox: bbox, params: params) else { return }
            if Task.isCancelled { return }
            await MainActor.run { pins = result }
        }
    }
}

/// The 48pt brand control square (blue fill, orange ring) shared by the locate
/// button and the filter trigger — mirrors the web's map control buttons.
@ViewBuilder
func controlTile<Glyph: View>(@ViewBuilder glyph: () -> Glyph) -> some View {
    glyph()
        .font(.system(size: 20, weight: .bold))
        .foregroundColor(Brand.orange)
        .frame(width: 48, height: 48)
        .background(Brand.blue)
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Brand.orange, lineWidth: 2))
        .shadow(color: .black.opacity(0.3), radius: 4, y: 2)
}

/// Floating filter button: a brand square trigger that fans a vertical column of
/// filter pills upward. Multi-select, so the list stays open; orange = active.
struct FilterFab: View {
    @Binding var active: Set<String>
    @Binding var open: Bool

    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            VStack(alignment: .trailing, spacing: 10) {
                ForEach(Filters.all) { filter in
                    if open {
                        FilterPill(filter: filter, isOn: active.contains(filter.key)) {
                            toggle(filter.key)
                        }
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                    }
                }
            }
            .padding(.bottom, 58) // clear the 48pt trigger + gap

            Button {
                withAnimation(.spring(response: 0.3, dampingFraction: 0.82)) { open.toggle() }
            } label: {
                controlTile {
                    Image(systemName: open ? "xmark" : "line.3.horizontal.decrease")
                }
                .overlay(alignment: .topTrailing) {
                    if !open && !active.isEmpty {
                        Text("\(active.count)")
                            .font(.system(size: 12, weight: .heavy))
                            .foregroundColor(.white)
                            .frame(minWidth: 22, minHeight: 22)
                            .background(Brand.red)
                            .clipShape(Circle())
                            .overlay(Circle().stroke(Brand.blue, lineWidth: 2))
                            .offset(x: 6, y: -6)
                    }
                }
            }
            .buttonStyle(.plain)
        }
    }

    private func toggle(_ key: String) {
        if active.contains(key) { active.remove(key) } else { active.insert(key) }
    }
}

/// One filter pill: localized label + emoji, white when off / orange when on.
struct FilterPill: View {
    let filter: BodegaFilter
    let isOn: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                Text(LocalizedStringKey(filter.label))
                    .font(.system(size: 14, weight: .bold))
                    .fixedSize()
                Text(filter.icon).font(.system(size: 18))
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 9)
            .foregroundColor(isOn ? .black : Brand.blue)
            .background(isOn ? Brand.orange : Color.white)
            .clipShape(Capsule())
            .overlay(Capsule().stroke(isOn ? Brand.orange : .clear, lineWidth: 2))
            .shadow(color: .black.opacity(0.28), radius: 6, y: 3)
        }
        .buttonStyle(.plain)
    }
}
