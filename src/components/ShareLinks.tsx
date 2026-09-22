import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { SHARE_URL } from '@/lib/site';

/** Plain links (no third-party scripts). Google+ from the legacy page is gone: the service shut down in 2019. */
export async function ShareLinks() {
  const t = await getTranslations('common');
  const url = encodeURIComponent(SHARE_URL);
  const targets = [
    { name: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${url}`, icon: '/images/facebookIcon.png' },
    { name: 'X', href: `https://x.com/intent/post?url=${url}`, icon: '/images/twitterIcon.png' },
    { name: 'LinkedIn', href: `https://www.linkedin.com/sharing/share-offsite/?url=${url}`, icon: '/images/linkedInIcon.png' },
  ];

  return (
    <div className="promo">
      <Image src="/images/hotline-banner.jpg" width={140} height={56} alt={t('hotlineBanner')} />
      <ul className="share" aria-label={t('share')}>
        {targets.map((target) => (
          <li key={target.name}>
            <a href={target.href} target="_blank" rel="noopener noreferrer" title={`${t('share')}: ${target.name}`}>
              <Image src={target.icon} width={32} height={32} alt={target.name} />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
