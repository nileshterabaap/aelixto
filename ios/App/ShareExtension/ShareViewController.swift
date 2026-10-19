import UIKit
import UniformTypeIdentifiers

/// Aelixto Share Extension: takes the first link (or text containing a link)
/// from the share sheet, stores it in the shared App Group, then opens
/// Aelixto, which reads it and pre-fills the create-post composer.
final class ShareViewController: UIViewController {
    private let appGroup = "group.com.aelixto.app10"
    private let key = "aelixto.pendingSharedUrl"

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .clear
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        extractLink { [weak self] link in
            guard let self = self else { return }
            if let link = link {
                let defaults = UserDefaults(suiteName: self.appGroup)
                defaults?.set(link, forKey: self.key)
                defaults?.synchronize()
                self.openHostApp()
            }
            self.extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
        }
    }

    private func extractLink(_ done: @escaping (String?) -> Void) {
        let providers = (extensionContext?.inputItems as? [NSExtensionItem] ?? [])
            .flatMap { $0.attachments ?? [] }
        let urlType = UTType.url.identifier
        let textType = UTType.plainText.identifier

        if let p = providers.first(where: { $0.hasItemConformingToTypeIdentifier(urlType) }) {
            p.loadItem(forTypeIdentifier: urlType, options: nil) { item, _ in
                let s = (item as? URL)?.absoluteString ?? (item as? String)
                DispatchQueue.main.async { done(s) }
            }
            return
        }
        if let p = providers.first(where: { $0.hasItemConformingToTypeIdentifier(textType) }) {
            p.loadItem(forTypeIdentifier: textType, options: nil) { item, _ in
                DispatchQueue.main.async { done(item as? String) }
            }
            return
        }
        done(nil)
    }

    /// Extensions cannot call UIApplication.shared; walk the responder chain.
    private func openHostApp() {
        guard let url = URL(string: "aelixto://share") else { return }
        var responder: UIResponder? = self
        while let r = responder {
            if let app = r as? UIApplication {
                app.open(url, options: [:], completionHandler: nil)
                return
            }
            responder = r.next
        }
        let sel = sel_registerName("openURL:")
        responder = self
        while let r = responder {
            if r.responds(to: sel) { _ = r.perform(sel, with: url); return }
            responder = r.next
        }
    }
}
