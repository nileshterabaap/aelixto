import UIKit
import UniformTypeIdentifiers

/// Aelixto Share Extension: takes the first web link (or text containing a
/// web link) from the share sheet, stores it in the shared App Group, then
/// opens Aelixto, which reads it and pre-fills the create-post composer.
///
/// If the shared content has no http(s) link, the extension closes quietly
/// and Aelixto is NOT opened — there would be nothing to post.
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

    // MARK: - Link extraction

    /// Returns the first http(s) link found in the shared items, or nil.
    private func extractLink(_ done: @escaping (String?) -> Void) {
        let providers = (extensionContext?.inputItems as? [NSExtensionItem] ?? [])
            .flatMap { $0.attachments ?? [] }
        let urlType = UTType.url.identifier
        let textType = UTType.plainText.identifier

        // URL attachments first (Safari, most apps), then text attachments
        // (apps that share "caption + link" as plain text).
        let urlProviders = providers.filter { $0.hasItemConformingToTypeIdentifier(urlType) }
        let textProviders = providers.filter {
            !$0.hasItemConformingToTypeIdentifier(urlType) && $0.hasItemConformingToTypeIdentifier(textType)
        }
        let queue: [(NSItemProvider, String)] =
            urlProviders.map { ($0, urlType) } + textProviders.map { ($0, textType) }

        tryNext(queue, index: 0) { link in
            DispatchQueue.main.async { done(link) }
        }
    }

    private func tryNext(_ queue: [(NSItemProvider, String)], index: Int, _ done: @escaping (String?) -> Void) {
        guard index < queue.count else { done(nil); return }
        let (provider, type) = queue[index]
        provider.loadItem(forTypeIdentifier: type, options: nil) { [weak self] item, _ in
            guard let self = self else { done(nil); return }
            if let link = self.webLink(from: item) {
                done(link)
            } else {
                self.tryNext(queue, index: index + 1, done)
            }
        }
    }

    /// Converts whatever the provider returned into an http(s) link string.
    private func webLink(from item: NSSecureCoding?) -> String? {
        if let url = item as? URL {
            if isWeb(url) { return url.absoluteString }
            return firstWebLink(in: url.absoluteString)
        }
        if let text = item as? String { return firstWebLink(in: text) }
        if let attributed = item as? NSAttributedString { return firstWebLink(in: attributed.string) }
        if let data = item as? Data, let text = String(data: data, encoding: .utf8) {
            return firstWebLink(in: text)
        }
        return nil
    }

    private func isWeb(_ url: URL) -> Bool {
        guard let scheme = url.scheme?.lowercased() else { return false }
        return (scheme == "http" || scheme == "https") && url.host != nil
    }

    private func firstWebLink(in text: String) -> String? {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty,
              let detector = try? NSDataDetector(types: NSTextCheckingResult.CheckingType.link.rawValue) else {
            return nil
        }
        let range = NSRange(trimmed.startIndex..., in: trimmed)
        for match in detector.matches(in: trimmed, options: [], range: range) {
            if let url = match.url, isWeb(url) { return url.absoluteString }
        }
        return nil
    }

    // MARK: - Hand-off

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
