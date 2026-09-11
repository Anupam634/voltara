import React, { useMemo, useState } from 'react';
import { Share, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';

import { Text } from '../ui/Text';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { useTheme } from '../../theme/ThemeProvider';
import { useFeedback } from '../../lib/feedback';
import { useToast } from '../ui/Toast';
import { useI18n } from '../../i18n';
import { WEB_URL } from '../../api/client';
import {
  decodeRigCode,
  encodeRigCode,
  rigCodeUrl,
  type RigCodePart,
} from '../../lib/rig-code';
import { fill, useRigCode } from './strings';

/**
 * The build code, with a way in and a way out.
 *
 * Read-only on the rig screen (this is your rig, here is its code); with a
 * paste field in the builder, where loading someone else's code is the whole
 * point of the feature.
 */
export function RigCodeBar({
  codes,
  catalog = [],
  onLoad,
  note,
  style,
}: {
  /** Current slot contents, nulls included. */
  codes: (string | null)[];
  /** Catalogue to validate against. Without it, unknown parts cannot be named. */
  catalog?: RigCodePart[];
  /** Omit for a read-only bar. */
  onLoad?: (codes: string[]) => void;
  /** Shown in place of the hint, e.g. "loaded from a shared link". */
  note?: string | null;
  style?: React.ComponentProps<typeof View>['style'];
}) {
  const { c, spacing, radius, alpha, monoFont } = useTheme();
  const S = useRigCode();
  const { locale } = useI18n();
  const feedback = useFeedback();
  const toast = useToast();

  const [input, setInput] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  const code = useMemo(() => encodeRigCode(codes, catalog), [codes, catalog]);
  const empty = code.length === 0;

  const onCopy = async () => {
    if (empty) return;
    feedback.tick();
    await Clipboard.setStringAsync(code);
    toast.show(S.copied);
  };

  const onShare = async () => {
    if (empty) return;
    feedback.press();
    const url = rigCodeUrl(WEB_URL, locale, code);
    try {
      await Share.share({ message: `${fill(S.shareText, { code })} ${url}` });
    } catch {
      // A dismissed share sheet is not an error worth reporting.
    }
  };

  const onSubmit = () => {
    const parsed = decodeRigCode(input, catalog);
    const unknownLine = (list: string[]) =>
      fill(list.length === 1 ? S.unknownOne : S.unknownMany, { list: list.join(', ') });

    if (!parsed || parsed.codes.length === 0) {
      feedback.error();
      setProblem(parsed && parsed.unknown.length > 0 ? unknownLine(parsed.unknown) : S.nothing);
      return;
    }
    feedback.tick();
    onLoad?.(parsed.codes);
    setInput('');
    setProblem(parsed.unknown.length > 0 ? unknownLine(parsed.unknown) : null);
    toast.show(S.loaded);
  };

  return (
    <View
      style={[
        {
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: c.border,
          backgroundColor: c.surfaceAlt,
          padding: spacing.md,
          gap: spacing.sm,
        },
        style,
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
        <Text variant="overline" tone="secondary" uppercase>
          {onLoad ? S.label : S.yourBuild}
        </Text>
        {note ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              paddingHorizontal: spacing.sm,
              paddingVertical: 2,
              borderRadius: radius.pill,
              backgroundColor: alpha(c.gold, 0.14),
            }}
          >
            <Ionicons name="checkmark" size={11} color={c.gold} />
            <Text variant="caption" weight="800" style={{ color: c.gold }}>
              {note}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Text
          numberOfLines={1}
          style={{
            flex: 1,
            fontFamily: monoFont,
            fontSize: 14,
            fontWeight: '800',
            letterSpacing: 0.5,
            color: empty ? c.textTertiary : c.gold,
            backgroundColor: c.bg,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: c.border,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
          }}
        >
          {empty ? S.empty : code}
        </Text>
      </View>

      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Button
          label={S.copy}
          icon="copy-outline"
          variant="secondary"
          size="sm"
          onPress={onCopy}
          disabled={empty}
          style={{ flex: 1 }}
        />
        <Button
          label={S.share}
          icon="share-social-outline"
          variant="secondary"
          size="sm"
          onPress={onShare}
          disabled={empty}
          style={{ flex: 1 }}
        />
      </View>

      {onLoad ? (
        <>
          <Text variant="caption" tone="tertiary">
            {S.hint}
          </Text>
          <Input
            value={input}
            onChangeText={(v) => {
              setInput(v);
              setProblem(null);
            }}
            placeholder={S.loadPlaceholder}
            error={problem}
            mono
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="go"
            onSubmitEditing={onSubmit}
          />
          <Button
            label={S.load}
            variant="primary"
            size="sm"
            onPress={onSubmit}
            disabled={!input.trim()}
            fullWidth
          />
        </>
      ) : null}
    </View>
  );
}
