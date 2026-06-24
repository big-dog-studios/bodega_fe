import MapKit
import SwiftUI
import UIKit

/// MKPointAnnotation carrying the license number so taps can open the teaser.
final class BodegaAnnotation: MKPointAnnotation {
    let license: String
    init(pin: StorePin) {
        license = pin.license_number
        super.init()
        coordinate = pin.coordinate
        title = pin.dba
    }
}

/// Square brand tiles (blue fill, orange ring + glyph) drawn once and reused —
/// mirrors the web app's pin/cluster look in storeLayers.ts. MKMarkerAnnotationView
/// is always a teardrop, so we render our own image instead.
enum BrandTiles {
    static let pin = make(label: "B")
    static let cluster = make(label: "•••")

    static func make(label: String) -> UIImage {
        let size: CGFloat = 30, pad: CGFloat = 4, border: CGFloat = 3, radius: CGFloat = 6
        let canvas = CGSize(width: size + pad * 2, height: size + pad * 2)
        return UIGraphicsImageRenderer(size: canvas).image { ctx in
            let cg = ctx.cgContext
            let rect = CGRect(
                x: pad + border / 2, y: pad + border / 2,
                width: size - border, height: size - border
            )
            let path = UIBezierPath(roundedRect: rect, cornerRadius: radius)
            cg.setShadow(
                offset: CGSize(width: 0, height: 2), blur: 3,
                color: UIColor.black.withAlphaComponent(0.3).cgColor
            )
            Brand.uiBlue.setFill()
            path.fill()
            cg.setShadow(offset: .zero, blur: 0, color: nil)
            Brand.uiOrange.setStroke()
            path.lineWidth = border
            path.stroke()
            let attrs: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: label.count > 1 ? 13 : 15, weight: .heavy),
                .foregroundColor: Brand.uiOrange,
            ]
            let str = NSAttributedString(string: label, attributes: attrs)
            let ts = str.size()
            str.draw(at: CGPoint(x: (canvas.width - ts.width) / 2, y: (canvas.height - ts.height) / 2))
        }
    }
}

/// MKMapView (UIKit) wrapped for SwiftUI — UIKit gives us native marker
/// clustering and view reuse, which SwiftUI's `Map` doesn't do well at the
/// pin counts the bbox query can return.
struct BodegaMapView: UIViewRepresentable {
    var pins: [StorePin]
    @Binding var recenterTo: CLLocationCoordinate2D?
    var onRegionSettled: (Bbox) -> Void
    var onSelect: (String) -> Void

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    func makeUIView(context: Context) -> MKMapView {
        let map = MKMapView()
        map.delegate = context.coordinator
        map.showsUserLocation = true
        map.pointOfInterestFilter = .excludingAll
        map.register(
            MKAnnotationView.self,
            forAnnotationViewWithReuseIdentifier: "bodega"
        )
        map.register(
            MKAnnotationView.self,
            forAnnotationViewWithReuseIdentifier: "cluster"
        )
        // Default to lower Manhattan until we get a fix / the user pans.
        map.setRegion(
            MKCoordinateRegion(
                center: .init(latitude: 40.7128, longitude: -73.99),
                span: .init(latitudeDelta: 0.08, longitudeDelta: 0.08)
            ),
            animated: false
        )
        return map
    }

    func updateUIView(_ map: MKMapView, context: Context) {
        context.coordinator.sync(pins: pins, on: map)
        if let target = recenterTo {
            map.setRegion(
                MKCoordinateRegion(
                    center: target,
                    span: .init(latitudeDelta: 0.02, longitudeDelta: 0.02)
                ),
                animated: true
            )
            DispatchQueue.main.async { recenterTo = nil }
        }
    }

    final class Coordinator: NSObject, MKMapViewDelegate {
        private let parent: BodegaMapView
        private var debounce: DispatchWorkItem?
        private var shownLicenses = Set<String>()

        init(_ parent: BodegaMapView) { self.parent = parent }

        /// Diff the annotation set so we don't churn the whole map every fetch.
        func sync(pins: [StorePin], on map: MKMapView) {
            let next = Set(pins.map { $0.license_number })
            guard next != shownLicenses else { return }
            shownLicenses = next
            let existing = map.annotations.compactMap { $0 as? BodegaAnnotation }
            map.removeAnnotations(existing)
            map.addAnnotations(pins.map { BodegaAnnotation(pin: $0) })
        }

        // Debounced bbox-on-idle: read the settled region, pad ~20%, fetch.
        func mapView(_ mapView: MKMapView, regionDidChangeAnimated animated: Bool) {
            debounce?.cancel()
            let work = DispatchWorkItem { [weak mapView, weak self] in
                guard let mapView, let self else { return }
                let r = mapView.region
                let padLat = r.span.latitudeDelta * 0.2
                let padLon = r.span.longitudeDelta * 0.2
                let bbox = Bbox(
                    west: r.center.longitude - r.span.longitudeDelta / 2 - padLon,
                    south: r.center.latitude - r.span.latitudeDelta / 2 - padLat,
                    east: r.center.longitude + r.span.longitudeDelta / 2 + padLon,
                    north: r.center.latitude + r.span.latitudeDelta / 2 + padLat
                )
                self.parent.onRegionSettled(bbox)
            }
            debounce = work
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.3, execute: work)
        }

        func mapView(_ mapView: MKMapView, viewFor annotation: MKAnnotation) -> MKAnnotationView? {
            if annotation is MKUserLocation { return nil }

            // Cluster — brand square with the "•••" dots, matching the web.
            if annotation is MKClusterAnnotation {
                let view = mapView.dequeueReusableAnnotationView(withIdentifier: "cluster", for: annotation)
                view.image = BrandTiles.cluster
                view.displayPriority = .required
                return view
            }

            // Single bodega — brand "B" tile; clusteringIdentifier turns on clustering.
            let view = mapView.dequeueReusableAnnotationView(withIdentifier: "bodega", for: annotation)
            view.image = BrandTiles.pin
            view.clusteringIdentifier = "bodega"
            view.displayPriority = .defaultLow
            return view
        }

        func mapView(_ mapView: MKMapView, didSelect view: MKAnnotationView) {
            if let cluster = view.annotation as? MKClusterAnnotation {
                var region = mapView.region
                region.center = cluster.coordinate
                region.span.latitudeDelta /= 3
                region.span.longitudeDelta /= 3
                mapView.setRegion(region, animated: true)
                mapView.deselectAnnotation(cluster, animated: false)
            } else if let bodega = view.annotation as? BodegaAnnotation {
                parent.onSelect(bodega.license)
                mapView.deselectAnnotation(bodega, animated: false)
            }
        }
    }
}
