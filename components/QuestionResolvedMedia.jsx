/**
 * Shows question media from static attachment and/or מאגר תגית (resolved via pickRandomMedia).
 */
import React, { useEffect, useState } from 'react';
import { pickRandomMedia } from '../workflows/mediaEngine';

export default function QuestionResolvedMedia({
  question,
  containerStyle,
  imageStyle,
  videoStyle,
}) {
  const [resolved, setResolved] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const att = question?.media_attachment;
      if (att) {
        const isStr = typeof att === 'string';
        const url = isStr ? att : att?.url;
        if (url) {
          const type = isStr ? 'image' : att.type || 'image';
          if (!cancelled) {
            setResolved({
              url,
              type,
              desc: isStr ? '' : att.desc || att.name || '',
            });
          }
          return;
        }
      }
      const tag =
        typeof question?.media_bank_tag === 'string' ? question.media_bank_tag.trim() : '';
      if (tag) {
        const item = await pickRandomMedia(tag);
        if (!cancelled && item?.url) {
          setResolved({
            url: item.url,
            type: item.media_type || 'image',
            desc: item.description || item.name || '',
          });
        } else if (!cancelled) setResolved(null);
        return;
      }
      if (!cancelled) setResolved(null);
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [question?.id, question?.media_attachment, question?.media_bank_tag]);

  if (!resolved?.url) return null;

  const imgS = imageStyle || {
    maxWidth: '100%',
    borderRadius: '8px',
    maxHeight: '220px',
    objectFit: 'contain',
  };
  const vidS = videoStyle || { maxWidth: '100%', borderRadius: '8px', maxHeight: '360px' };

  return (
    <div style={containerStyle} role="region" aria-label="מדיה לשאלה">
      {(!resolved.type || resolved.type === 'image') && (
        <img
          src={resolved.url}
          alt={resolved.desc || 'מדיה לשאלה'}
          style={imgS}
          loading="lazy"
        />
      )}
      {resolved.type === 'video' && (
        <video
          src={resolved.url}
          controls
          style={vidS}
          aria-label={resolved.desc || 'וידאו לשאלה'}
        />
      )}
      {resolved.type === 'audio' && (
        <audio
          src={resolved.url}
          controls
          style={{ width: '100%', marginTop: '8px' }}
          aria-label={resolved.desc || 'אודיו לשאלה'}
        />
      )}
      {resolved.desc ? (
        <p
          style={{
            fontSize: '12px',
            color: '#78909c',
            textAlign: 'center',
            margin: '4px 0 0',
          }}
        >
          {resolved.desc}
        </p>
      ) : null}
    </div>
  );
}
