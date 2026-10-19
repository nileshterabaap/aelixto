import UIKit
import GoogleMobileAds

/// iOS twin of the Android ad card (rounded-[2rem] white card, 1px border,
/// 48pt avatar + advertiser + "Sponsored", bold 20pt headline above media,
/// caption below, full-width 56pt brand-blue CTA bar with chevron).
final class AelixtoNativeAdView: GADNativeAdView {
    private let card = UIView()
    private let icon = UIImageView()
    private let advertiser = UILabel()
    private let sponsored = UILabel()
    private let headline = UILabel()
    private let media = GADMediaView()
    private let body = UILabel()
    private let ctaBar = UIView()
    private let cta = UILabel()
    private let chevron = UILabel()

    private let radius: CGFloat = 32
    private let padH: CGFloat = 20
    private let brandBlue = UIColor(red: 0, green: 0x80 / 255.0, blue: 1, alpha: 1)
    private let muted = UIColor(white: 0x73 / 255.0, alpha: 1)
    private let border = UIColor(red: 0xE4 / 255.0, green: 0xE7 / 255.0, blue: 0xEB / 255.0, alpha: 1)
    private let mutedBg = UIColor(white: 0xF5 / 255.0, alpha: 1)

    func configure(with ad: GADNativeAd) {
        backgroundColor = .clear
        card.backgroundColor = .white
        card.layer.cornerRadius = radius
        card.layer.borderWidth = 1
        card.layer.borderColor = border.cgColor
        card.clipsToBounds = true
        addSubview(card)

        icon.contentMode = .scaleAspectFill
        icon.clipsToBounds = true
        icon.layer.cornerRadius = 24
        icon.backgroundColor = mutedBg
        icon.image = ad.icon?.image
        card.addSubview(icon); iconView = icon

        advertiser.font = .boldSystemFont(ofSize: 16)
        advertiser.textColor = .black
        advertiser.text = ad.advertiser ?? ad.headline ?? "Sponsored"
        card.addSubview(advertiser); advertiserView = advertiser

        sponsored.font = .systemFont(ofSize: 13)
        sponsored.textColor = muted
        sponsored.text = "Sponsored"
        card.addSubview(sponsored)

        headline.font = .boldSystemFont(ofSize: 20)
        headline.textColor = .black
        headline.numberOfLines = 2
        headline.text = ad.headline
        card.addSubview(headline); headlineView = headline

        media.contentMode = .scaleAspectFit
        media.backgroundColor = mutedBg
        media.mediaContent = ad.mediaContent
        card.addSubview(media); mediaView = media

        body.font = .systemFont(ofSize: 15)
        body.textColor = .black
        body.numberOfLines = 3
        body.text = ad.body
        body.isHidden = (ad.body ?? "").isEmpty
        card.addSubview(body); bodyView = body

        ctaBar.backgroundColor = brandBlue
        ctaBar.isUserInteractionEnabled = false // SDK routes taps
        cta.font = .boldSystemFont(ofSize: 16)
        cta.textColor = .white
        cta.text = ad.callToAction ?? "Learn more"
        chevron.font = .boldSystemFont(ofSize: 20)
        chevron.textColor = .white
        chevron.text = "›"
        ctaBar.addSubview(cta)
        ctaBar.addSubview(chevron)
        card.addSubview(ctaBar); callToActionView = ctaBar
        ctaBar.isHidden = (ad.callToAction ?? "").isEmpty
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        let w = bounds.width, h = bounds.height
        card.frame = bounds
        let textW = max(0, w - padH * 2)

        icon.frame = CGRect(x: padH, y: 16, width: 48, height: 48)
        let nameX = padH + 48 + 12
        advertiser.frame = CGRect(x: nameX, y: 18, width: max(0, w - nameX - padH), height: 22)
        sponsored.frame = CGRect(x: nameX, y: 42, width: max(0, w - nameX - padH), height: 18)

        var y: CGFloat = 16 + 48 + 12
        let headH = headline.text?.isEmpty == false
            ? ceil(headline.sizeThatFits(CGSize(width: textW, height: 60)).height) : 0
        headline.frame = CGRect(x: padH, y: y, width: textW, height: headH)
        if headH > 0 { y += headH + 14 }

        let ctaH: CGFloat = ctaBar.isHidden ? 0 : 56
        let bodyH: CGFloat = body.isHidden ? 0
            : ceil(body.sizeThatFits(CGSize(width: textW, height: 70)).height) + 28
        let mediaH = max(0, h - y - bodyH - ctaH)
        media.frame = CGRect(x: 0, y: y, width: w, height: mediaH)
        y += mediaH
        body.frame = CGRect(x: padH, y: y + 14, width: textW, height: max(0, bodyH - 28))
        y += bodyH

        ctaBar.frame = CGRect(x: 0, y: h - ctaH, width: w, height: ctaH)
        cta.frame = CGRect(x: padH, y: 0, width: max(0, w - padH - 48), height: ctaH)
        chevron.frame = CGRect(x: w - 40, y: 0, width: 20, height: ctaH)
    }
}
