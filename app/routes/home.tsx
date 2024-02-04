import { json, LoaderFunction } from "@remix-run/node";
import { useLoaderData, Outlet } from '@remix-run/react'

import { Kudo as IKudo, Profile, Prisma, User } from '@prisma/client'

import { requireUserId } from "~/utils/auth.server";
import { getOtherUsers } from "~/utils/user.server";
import { getFilteredKudos, getRecentKudos } from '~/utils/kudos.server'
import { Kudo } from '~/components/kudo'
import { Layout } from "~/components/layout";
import { UserPanel } from "~/components/user-panel";
import { RecentBar } from '~/components/recent-bar'
import { SearchBar } from '~/components/search-bar'

export interface KudoWithProfile extends IKudo {
  author: {
    profile: Profile
  }
}

export interface KudoWithRecipient extends IKudo {
  recipient: User
}

export const loader: LoaderFunction = async ({ request }) => {
  const userId = await requireUserId(request);
  const users: User[] = await getOtherUsers(userId);

  const url = new URL(request.url)
  const sort = url.searchParams.get('sort')
  const filter = url.searchParams.get('filter')

  let sortOptions: Prisma.KudoOrderByWithRelationInput = {}
  if (sort) {
    if (sort === 'date') {
      sortOptions = { createdAt: 'desc' }
    }
    if (sort === 'sender') {
      sortOptions = { author: { profile: { firstName: 'asc' } } }
    }
    if (sort === 'emoji') {
      sortOptions = { style: { emoji: 'asc' } }
    }
  }

  let textFilter: Prisma.KudoWhereInput = {}
  if (filter) {
    textFilter = {
      OR: [
        { message: { mode: 'insensitive', contains: filter } },
        {
          author: {
            OR: [
              { profile: { is: { firstName: { mode: 'insensitive', contains: filter } } } },
              { profile: { is: { lastName: { mode: 'insensitive', contains: filter } } } },
            ],
          },
        },
      ],
    }
  }

  const kudos = await getFilteredKudos(userId, sortOptions, textFilter)
  const recentKudos = await getRecentKudos()
  return json({ users, kudos, recentKudos })
};

export default function Home() {
  const { users, kudos, recentKudos } = useLoaderData<{ users: User[]; kudos: KudoWithProfile[], recentKudos: KudoWithRecipient[] }>()

  return (
    <Layout>
      <Outlet />
      <div className="h-full flex">
        <UserPanel users={users as unknown as User[]} />
        
        <div className="flex-1 flex flex-col">
        <SearchBar />
          <div className="flex-1 flex">
            <div className="w-full p-10 flex flex-col gap-y-4">
              {(kudos as unknown as KudoWithProfile[]).map((kudo: KudoWithProfile) => (
                <Kudo key={kudo.id} kudo={kudo} profile={kudo.author.profile} />
              ))}
            </div>
            <RecentBar kudos={recentKudos as unknown as KudoWithRecipient[]} />
          </div>
        </div>
      </div>
    </Layout>
  );
}
